import {
  DatasetDownloadMetadata,
  Downloads,
  ExportDataQuery,
  ExportMergedDataQuery,
  ExportMutationTableQuery,
  FeatureValidationQuery,
  ValidationResult,
} from "@depmap/data-slicer";
import {
  CeleryTask,
  Dataset,
  UnivariateAssociationsParams,
  ComputeResponse,
} from "@depmap/compute";
import { Compound, EntityType } from "src/entity/models/entities";
import {
  ScreenType,
  GenePredictiveModelResults,
  CompoundDosePredictiveModelResults,
} from "src/predictability/models/predictive";
import {
  CellignerColorsForCellLineSelector,
  CellLineSelectorLines,
} from "@depmap/cell-line-selector";
import { UploadTask, UserUploadArgs } from "@depmap/user-upload";

import {
  CurvePlotPoints,
  CurveParams,
  DoseCurveData,
} from "src/compound/components/DoseResponseCurve";
import {
  AddDatasetOneRowArgs,
  AssociationAndCheckbox,
  Dataset as BreadboxDataset,
  DatasetParams,
  DatasetUpdateArgs,
  Group,
  GroupArgs,
  GroupEntry,
  GroupEntryArgs,
  InvalidPrioritiesByDataType,
  SearchDimenionsRequest,
  SearchDimenionsResponse,
  DimensionType,
  DimensionTypeAddArgs,
  DimensionTypeUpdateArgs,
  SliceQuery,
} from "@depmap/types";
import { TDASummaryTable } from "src/tda/models/types";
import { CompoundSummaryTableRaw } from "src/compoundDashboard/models/types";
import { log } from "src/common/utilities/log";
import {
  ConstellationGraphInputs,
  ConnectivityValue,
} from "src/constellation/models/constellation";
import { encodeParams } from "@depmap/utils";

import {
  OncogenicAlteration,
  CellLineDataMatrix,
  ModelInfo,
} from "src/cellLine/models/types";
import TopFeatureValue from "src/celfie/models/celfie";
import { Trace, ActiveSpan, NoOpSpan } from "src/trace";
import {
  ContextInfo,
  ContextSummary,
  DataType,
  getDataTypeColorCategoryFromDataTypeValue,
  Summary,
  ContextPlotBoxData,
  ContextExplorerDatasets,
  SearchOptionsByTreeType,
  ContextPathInfo,
  AvailabilitySummary,
  DataAvailabilitySummary,
  ContextAnalysisTableType,
  EnrichedLineagesTileData,
} from "src/contextExplorer/models/types";
import {
  DataAvailability,
  DataAvailSummary,
  DataPageDataType,
  getDataPageDataTypeColorCategory,
  LineageAvailability,
} from "./dataPage/models/types";

export interface RenderTile {
  html: string;
  postRenderCallback: string;
}

export interface EntityLookupResult {
  label: string;
  value: string;
  description: string;
  entity_id: string;
  type: string;
  url: string;
}

export type DoseResponseCurvePromise = {
  curve_params: Array<CurveParams>;
  points: Array<CurvePlotPoints>;
};

export type EntitySummaryResponse = {
  description: string;
  entity_type: "gene" | "compound";
  interactive_url: string;
  legend: {
    expression: {
      entries: Array<{ diameter: number; label: string }>;
      units: string;
    };
    mutation: Array<{ color: number; label: string }>;
  };
  line: number;
  strip: {
    traces: Array<{
      category: string;
      data: {
        cell_line_information: Array<{
          cell_line_display_name: string;
          depmap_id: string;
        }>;
        depmap_id: Array<string>;
        label: Array<string>;
        mutation_num: Array<number>;
        size: Array<number>;
        value: Array<number>;
      };
      lineage_level: number;
      num_lines: number;
    }>;
    url_root: string;
  };
  x_label: string;
  x_range: [number, number];
};

// These should match the view names for url_for
type PageUrl = "cell_line.view_cell_line" | "constellation.view_constellation";

const PAGE_URL_ROOTS: Map<PageUrl, string> = new Map([
  ["cell_line.view_cell_line", "/cell_line/"],
  ["constellation.view_constellation", "/constellation/"],
]);

const contextExplRequestCache: Record<string, Promise<unknown> | null> = {};

export type GeneCharacterizationData = {
  dataset: string;
  display_name: string;
  id: string;
  sublineage_plot: {
    ajax_url: string;
    download_url: string;
    interactive_url: string;
    name: string;
  };
}[];

export class DepmapApi {
  urlPrefix: string;

  trace: Trace | null = null;

  constructor(urlPrefix: string) {
    this.urlPrefix = urlPrefix === "/" ? "" : urlPrefix;
  }

  getUrlRoot(page: PageUrl) {
    return this.urlPrefix + PAGE_URL_ROOTS.get(page);
  }

  getTraceParentField() {
    if (this.trace && this.trace.traceID && this.trace.currentSpan) {
      return `00-${this.trace.traceID}-${this.trace.currentSpan.spanID}-01`;
    }
    return null;
  }

  _fetch = <T>(url: string): Promise<T> => {
    const headers: { [key: string]: string } = {};
    const traceParentField = this.getTraceParentField();
    if (traceParentField) {
      headers.traceparent = traceParentField;
    }

    const fullUrl = this.urlPrefix + url;
    log(`fetching ${fullUrl}`);
    return fetch(fullUrl, {
      credentials: "include",
      headers,
    }).then(
      (response: Response): Promise<T> => {
        log(`response arrived from ${fullUrl}`);
        return response.json().then(
          (body: T): Promise<T> => {
            // nesting to access response.status
            if (response.status >= 200 && response.status < 300) {
              return Promise.resolve(body);
            }
            return Promise.reject(body);
          }
        );
      }
    );
  };

  _fetchIncludeContextExplCache = async <T>(url: string): Promise<T> => {
    if (!contextExplRequestCache[url]) {
      const headers: { [key: string]: string } = {};
      const traceParentField = this.getTraceParentField();
      if (traceParentField) {
        headers.traceparent = traceParentField;
      }
      const fullUrl = this.urlPrefix + url;
      log(`fetching ${fullUrl}`);
      contextExplRequestCache[url] = new Promise((resolve, reject) => {
        fetch(fullUrl, {
          credentials: "include",
          headers,
        })
          .then((response) => {
            return response.json().then((body) => {
              if (response.status >= 200 && response.status < 300) {
                const result = body;
                contextExplRequestCache[url] = Promise.resolve(result);
                resolve(result);
              } else {
                contextExplRequestCache[url] = null;
                reject(body);
              }
            });
          })
          .catch((e) => {
            contextExplRequestCache[url] = null;
            reject(e);
          });
      });
    }

    return contextExplRequestCache[url] as Promise<T>;
  };

  _fetchText = (url: string): Promise<string> => {
    return fetch(this.urlPrefix + url, {
      credentials: "include",
    }).then((response: Response) => {
      return response.text();
    });
  };

  _getFileUrl = (url: string): string => {
    return this.urlPrefix + url;
  };

  _postJson = <T>(url: string, args: any): Promise<T> => {
    const fullUrl = this.urlPrefix + url;
    log(`post json to ${fullUrl}`);

    const headers: { [key: string]: string } = {
      "Content-Type": "application/json",
      Accept: "application/json",
    };
    const traceParentField = this.getTraceParentField();
    if (traceParentField) {
      // eslint-disable-next-line @typescript-eslint/dot-notation
      headers["traceparent"] = traceParentField;
    }
    return fetch(fullUrl, {
      credentials: "include",
      method: "POST",
      headers,
      body: JSON.stringify(args),
    }).then(
      (response: Response): Promise<T> => {
        log(`response arrived from ${fullUrl}`);
        return response.json().then(
          (body: T): Promise<T> => {
            // nesting to access response.status
            if (response.status >= 200 && response.status < 300) {
              return Promise.resolve(body);
            }
            return Promise.reject(body);
          }
        );
      }
    );
  };

  _post = <T>(url: string, args: any): Promise<T> => {
    const fullUrl = this.urlPrefix + url;
    log(`post to ${fullUrl}`);

    const data = encodeParams(args);
    return window
      .fetch(fullUrl, {
        credentials: "include",
        method: "POST",
        body: data,
      })
      .then(
        (response: Response): Promise<T> => {
          log(`response arrived from ${fullUrl}`);
          return response.json().then(
            (body: T): Promise<T> => {
              // nesting to access response.status
              if (response.status >= 200 && response.status < 300) {
                return Promise.resolve(body);
              }
              return Promise.reject(body);
            }
          );
        }
      );
  };

  _postForm = <T>(url: string, args: FormData): Promise<T> => {
    const fullUrl = this.urlPrefix + url;
    log(`post to ${fullUrl}`);

    return fetch(fullUrl, {
      method: "POST",
      body: args,
    }).then(
      (response: Response): Promise<T> => {
        log(`response arrived from ${fullUrl}`);
        return response.json().then(
          (body: T): Promise<T> => {
            // nesting to access response.status
            if (response.status >= 200 && response.status < 300) {
              return Promise.resolve(body);
            }
            return Promise.reject(body);
          }
        );
      }
    );
  };

  _postMultipart = <T>(url: string, args: any): Promise<T> => {
    const fullUrl = this.urlPrefix + url;
    log(`post multipart to ${fullUrl}`);

    const data = new FormData();
    // eslint-disable-next-line no-restricted-syntax
    for (const prop in args) {
      if (Object.prototype.hasOwnProperty.call(args, prop)) {
        data.append(prop, args[prop]);
      }
    }
    return fetch(fullUrl, {
      credentials: "include",
      method: "POST",
      body: data,
    }).then(
      (response: Response): Promise<T> => {
        log(`response arrived from ${fullUrl}`);
        return response.json().then(
          (body: T): Promise<T> => {
            // nesting to access response.status
            if (response.status >= 200 && response.status < 300) {
              return Promise.resolve(body);
            }
            // eslint-disable-next-line prefer-promise-reject-errors
            return Promise.reject({ body, status: response.status } as {
              body: T;
              status: number;
            });
          }
        );
      }
    );
  };

  _deleteJson = (url: string, args: any): Promise<Response> => {
    const fullUrl = this.urlPrefix + url;
    log(`post json to ${fullUrl}`);

    return fetch(fullUrl, {
      credentials: "include",
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(args),
    });
  };

  getAssociations(x: string): Promise<AssociationAndCheckbox> {
    const params: any = {
      x,
    };
    return this._fetch<AssociationAndCheckbox>(
      `/interactive/api/associations?${encodeParams(params)}`
    );
  }

  getGeneUrlRoot(): Promise<string> {
    return this._fetch<string>("/gene/geneUrlRoot");
  }

  async getTile(
    subjectType: string,
    tileName: string,
    identifier: string
  ): Promise<{ html: string; postRenderCallback: any }> {
    const tileJSON = await this._fetch<RenderTile>(
      `/tile/${subjectType}/${tileName}/${identifier}`
    );
    return tileJSON;
  }

  getGenePreditabilityTile(geneSymbol: string) {
    const predictabilityHTML = this._fetch<RenderTile>(
      `/tile/gene/predictability/${geneSymbol}`
    ).then((json) => {
      return json.html;
    });

    return predictabilityHTML;
  }

  getCompoundsTargetingGene(geneSymbol: string): Promise<Array<Compound>> {
    return this._fetch<Array<Compound>>(`/gene/compound/${geneSymbol}`);
  }

  getGeneCharacterizationData(
    geneSymbol: string
  ): Promise<GeneCharacterizationData> {
    return this._fetch<any>(`/gene/gene_characterization_data/${geneSymbol}`);
  }

  getCellLineUrlRoot(): Promise<string> {
    return this._fetch<string>("/interactive/api/cellLineUrlRoot");
  }

  getFeedbackUrl(): Promise<string> {
    return this._fetch<string>("/feedbackUrlRoot");
  }

  getMorpheusUrl(csvUrl: string): Promise<string> {
    return this._fetch<string>(
      `/morpheusUrl?${encodeParams({ csv_url: csvUrl })}`
    );
  }

  getCitationUrl(datasetId: string): Promise<string> {
    return this._fetch<string>(
      `/download/citationUrl?${encodeParams({ dataset_id: datasetId })}`
    );
  }

  getCompoundUrlRoot(): Promise<string> {
    return this._fetch<string>("/compound/compoundUrlRoot");
  }

  getContextExplorerUrlRoot(): Promise<string> {
    return this._fetch<string>("/context_explorer");
  }

  getDatasets(): Promise<Array<Dataset>> {
    return this._fetch<Dataset[]>("/interactive/api/getDatasets");
  }

  postCustomCsv = (config: UserUploadArgs): Promise<UploadTask> => {
    return this._postMultipart<UploadTask>(
      "/interactive/api/dataset/add-csv",
      config
    );
  };

  postCustomCsvOneRow(config: AddDatasetOneRowArgs): Promise<UploadTask> {
    return this._postMultipart<UploadTask>(
      "/interactive/api/dataset/add-csv-one-row",
      config
    );
  }

  entityLookup(
    datasetId: string,
    prefix: string
  ): Promise<Array<EntityLookupResult>> {
    const params = {
      dataset: datasetId,
      prefix,
    };
    return this._fetch<Array<EntityLookupResult>>(
      `/compute/api/entity-lookup?${encodeParams(params)}`
    );
  }

  getTaskStatus(id: string): Promise<CeleryTask> {
    return this._fetch<CeleryTask>(`/api/task/${id}`);
  }

  getAllDataTabDownloadData(): Promise<Downloads> {
    return this._fetch<Downloads>("/data_page/api/data");
  }

  getCellLineSelectorLines(): Promise<CellLineSelectorLines> {
    return this._fetch<CellLineSelectorLines>(
      "/partials/data_table/cell_line_selector_lines"
    );
  }

  getCellignerColorMap(): Promise<CellignerColorsForCellLineSelector> {
    return this._fetch<CellignerColorsForCellLineSelector>("/celligner/colors");
  }

  getCellLinePrefDepData(
    data_type: "crispr" | "rnai",
    depmapId: string
  ): Promise<CellLineDataMatrix> {
    return this._fetch<CellLineDataMatrix>(
      `/cell_line/prefdep/${data_type}/${depmapId}`
    );
  }

  getCellLineDescriptionTileData(modelId: string): Promise<ModelInfo> {
    return this._fetch<ModelInfo>(`/cell_line/description_tile/${modelId}`);
  }

  getCellLineCompoundSensitivityData(
    depmapId: string
  ): Promise<CellLineDataMatrix> {
    return this._fetch<CellLineDataMatrix>(
      `/cell_line/compound_sensitivity/${depmapId}`
    );
  }

  getCellLineDatasets(depmapId: string): Promise<any> {
    return this._fetch<{ [key: string]: any[] }>(
      `/cell_line/datasets/${depmapId}`
    ).then((datasetTypeDatasets: { [key: string]: any[] }) => {
      return Object.keys(datasetTypeDatasets).map((dataType: any) => {
        const formattedDatasetDataType = {
          dataType,
          datasets: datasetTypeDatasets[dataType],
        };

        return formattedDatasetDataType;
      });
    });
  }

  getContextPath(selectedCode: string): Promise<ContextPathInfo> {
    const params = {
      selected_code: selectedCode,
    };

    return this._fetch<ContextPathInfo>(
      `/api/context_explorer/context_path?${encodeParams(params)}`
    );
  }

  async getSubtypeDataAvailability(
    selectedCode: string
  ): Promise<ContextSummary> {
    const params = {
      selected_code: selectedCode,
    };

    const subtypeDataAvail = await this._fetch<Summary>(
      `/api/context_explorer/subtype_data_availability?${encodeParams(params)}`
    );

    const dataAvailVals = subtypeDataAvail.values.map(
      (datatypeVals: boolean[], index: number) =>
        datatypeVals.map((val: boolean) => {
          const dType =
            DataType[
              subtypeDataAvail.data_types[index] as keyof typeof DataType
            ];
          return getDataTypeColorCategoryFromDataTypeValue(dType, val);
        })
    );

    return {
      all_depmap_ids: subtypeDataAvail.all_depmap_ids,
      data_types: subtypeDataAvail.data_types,
      values: dataAvailVals,
    };
  }

  getContextSearchOptions(): Promise<SearchOptionsByTreeType> {
    return this._fetch<SearchOptionsByTreeType>(
      `/api/context_explorer/context_search_options`
    );
  }

  getNodeName(subtypeCode: string): Promise<string> {
    const params = {
      subtype_code: subtypeCode,
    };
    return this._fetch<string>(
      `/api/context_explorer/context_node_name?${encodeParams(params)}`
    );
  }

  getContextExplorerContextInfo(subtypeCode: string): Promise<ContextInfo> {
    const params = {
      level_0_subtype_code: subtypeCode,
    };

    return this._fetch<ContextInfo>(
      `/api/context_explorer/context_info?${encodeParams(params)}`
    );
  }

  getContextExplorerDoseResponsePoints(
    datasetName: string,
    subtypeCode: string,
    outGroupType: string,
    compoundLabel: string,
    selectedLevel: number,
    treeType: string
  ): Promise<DoseCurveData> {
    const params = {
      dataset_name: datasetName,
      subtype_code: subtypeCode,
      entity_full_label: compoundLabel,
      level: selectedLevel,
      out_group_type: outGroupType,
      tree_type: treeType,
    };

    return this._fetchIncludeContextExplCache<DoseCurveData>(
      `/api/context_explorer/context_dose_curves?${encodeParams(params)}`
    );
  }

  getContextExplorerAnalysisData(
    in_group_code: string,
    out_group_type: string,
    entity_type: string,
    dataset_name: ContextExplorerDatasets
  ): Promise<ContextAnalysisTableType> {
    const params = {
      in_group: in_group_code,
      out_group_type,
      entity_type,
      dataset_name,
    };

    return this._fetch<ContextAnalysisTableType>(
      `/api/context_explorer/analysis_data?${encodeParams(params)}`
    );
  }

  getContextExplorerBoxPlotData(
    selected_subtype_code: string,
    tree_type: string,
    dataset_name: ContextExplorerDatasets,
    entity_type: string,
    entity_full_label: string,
    max_fdr: number,
    min_abs_effect_size: number,
    min_frac_dep_in: number,
    doShowPositiveEffectSizes: boolean
  ): Promise<ContextPlotBoxData> {
    const params: any = {
      selected_subtype_code,
      tree_type,
      dataset_name,
      out_group: "All Others",
      entity_type,
      entity_full_label,
      max_fdr,
      min_abs_effect_size,
      min_frac_dep_in,
      show_positive_effect_sizes: doShowPositiveEffectSizes,
    };

    return this._fetchIncludeContextExplCache<ContextPlotBoxData>(
      `/api/context_explorer/context_box_plot_data?${encodeParams(params)}`
    );
  }

  getEnrichmentTileData(
    tree_type: string,
    entity_type: string,
    entity_label: string
  ): Promise<EnrichedLineagesTileData> {
    const params: any = {
      tree_type,
      entity_type,
      entity_label,
    };

    return this._fetch<EnrichedLineagesTileData>(
      `/api/context_explorer/enriched_lineages_tile?${encodeParams(params)}`
    );
  }

  async getContextDataAvailability(
    tree_type: string
  ): Promise<DataAvailabilitySummary> {
    const params: any = { tree_type };
    const summaryAndTable = await this._fetch<AvailabilitySummary>(
      `/api/context_explorer/context_summary?${encodeParams(params)}`
    );

    const boolSummary = summaryAndTable.summary;
    const table = summaryAndTable.table;

    const dataAvailVals = boolSummary.values.map(
      (datatypeVals: boolean[], index: number) =>
        datatypeVals.map((val: boolean) => {
          const dType =
            DataType[boolSummary.data_types[index] as keyof typeof DataType];
          return getDataTypeColorCategoryFromDataTypeValue(dType, val);
        })
    );

    const contextSummary = {
      all_depmap_ids: boolSummary.all_depmap_ids,
      data_types: boolSummary.data_types,
      // The original True/False values returned from the backend are
      // mapped to color category integers. The integer maps to Heatmap.tsx's
      // color scale.
      values: dataAvailVals,
    };

    return {
      summary: contextSummary,
      table,
    };
  }

  async getDataPageDataAvailability(): Promise<DataAvailability> {
    const boolSummary = await this._fetch<DataAvailSummary>(
      "/api/data_page/data_availability"
    );

    const dataTypes = Object.keys(boolSummary.data_type_url_mapping);
    const dataAvailVals = boolSummary.values.map(
      (datatypeVals: boolean[], index: number) =>
        datatypeVals.map((val: boolean) => {
          const dType =
            DataPageDataType[dataTypes[index] as keyof typeof DataPageDataType];
          return getDataPageDataTypeColorCategory(dType, val);
        })
    );

    return {
      all_depmap_ids: boolSummary.all_depmap_ids,
      // The original True/False values returned from the backend are
      // mapped to color category integers. The integer maps to Heatmap.tsx's
      // color scale.
      data_type_url_mapping: boolSummary.data_type_url_mapping,
      drug_count_mapping: boolSummary.drug_count_mapping,
      values: dataAvailVals,
      data_types: boolSummary.data_types,
    };
  }

  getLineageDataAvailability(dataType: string): Promise<LineageAvailability> {
    const params = {
      data_type: dataType,
    };
    return this._fetch<LineageAvailability>(
      `/api/data_page/lineage_availability?${encodeParams(params)}`
    );
  }

  getOncogenicAlterations(
    depmapId: string
  ): Promise<{
    onco_alterations: Array<OncogenicAlteration>;
    oncokb_dataset_version: string;
  }> {
    return this._fetch<{
      onco_alterations: Array<OncogenicAlteration>;
      oncokb_dataset_version: string;
    }>(`/cell_line/oncogenic_alterations/${depmapId}`);
  }

  getPredictiveTableCompound(compoundLabel: string) {
    const params = {
      compoundLabel,
    };
    return this._fetch<
      Array<{
        screen: string;
        compoundExperimentId: string;
        modelsAndResults: Array<CompoundDosePredictiveModelResults>;
      }>
    >(`/compound/api/predictive?${encodeParams(params)}`);
  }

  getPredictiveTableGene(entityId: number) {
    const params = {
      entityId,
    };
    return this._fetch<
      Array<{
        screen: string;
        screenType: ScreenType;
        modelsAndResults: Array<GenePredictiveModelResults>;
      }>
    >(`/gene/api/predictive?${encodeParams(params)}`);
  }

  getDoseResponsePoints(
    datasetName: string,
    depmapId: string,
    compoundLabel: string
  ): Promise<DoseResponseCurvePromise> {
    return this._fetch<DoseResponseCurvePromise>(
      `/compound/dosecurve/${datasetName}/${depmapId}/${compoundLabel}`
    );
  }

  getDoseResponseTable(datasetName: string, xrefFull: string): Promise<any> {
    return this._fetch<any>(`/compound/dosetable/${datasetName}/${xrefFull}`);
  }

  getCellignerDistancesToTumors(
    primarySite: string,
    subtype: string
  ): Promise<any> {
    return this._fetch<any>(
      `/celligner/distance_tumors_to_cell_lines?${encodeParams({
        primarySite,
        subtype,
      })}`
    );
  }

  getCellignerDistancesToCellLine(sampleId: string, kNeighbors: number) {
    return this._fetch<{
      distance_to_tumors: Array<number>;
      most_common_lineage: string;
      color_indexes: Array<number>;
    }>(
      `/celligner/distance_cell_line_to_tumors?${encodeParams({
        sampleId,
        kNeighbors,
      })}`
    );
  }

  computeUnivariateAssociations(
    config: UnivariateAssociationsParams
  ): Promise<ComputeResponse> {
    return this._postJson<ComputeResponse>(
      "/compute/compute_univariate_associations",
      config
    );
  }

  startTrace(label: string) {
    this.trace = new Trace(label);
  }

  endTrace() {
    if (this.trace) {
      this.trace.end();
      const spanList = this.trace.getSpanSubmission();
      this._postJson<any>("/dev/record_spans", {
        spans: spanList,
        traceId: this.trace.traceID,
      }).then((result) => {
        console.log("record spans returned:", result);
      });
      this.trace = null;
    }
  }

  withSpan(parentSpan: ActiveSpan, apiCall: () => any) {
    // set current span before making an api call and then restore the value afterwards
    // useful for making the API call report a desired parentage

    if (this.trace) {
      const origCurrentSpan = this.trace.currentSpan;
      this.trace.currentSpan = parentSpan as any; // fixme: should handle this gracefully. Add check on type
      try {
        return apiCall();
      } finally {
        this.trace.currentSpan = origCurrentSpan;
      }
    }

    return apiCall();
  }

  startSpan(label: string): ActiveSpan {
    if (this.trace) {
      if (this.trace.currentSpan) {
        return this.trace.currentSpan.startChild(label);
      }
      console.log(
        "Tracing appears to be enabled, but no current span, could not start",
        label
      );
    }
    return NoOpSpan;
  }

  getMutationTableCitation(): Promise<string> {
    return this._fetch<string>(`/api/download/mutation_table_citation`);
  }

  exportMutationTable(query: ExportMutationTableQuery): Promise<any> {
    return this._postJson<any>("/api/download/custom_mutation_table", query);
  }

  exportData(query: ExportDataQuery): Promise<any> {
    return this._postJson<any>("/api/download/custom", query);
  }

  exportDataForMerge(query: ExportMergedDataQuery): Promise<any> {
    return this._postJson<any>("/api/download/custom_merged", query);
  }

  getDatasetsList(): Promise<DatasetDownloadMetadata[]> {
    return this._fetch<any>("/api/download/datasets");
  }

  validateFeaturesInDataset(
    query: FeatureValidationQuery
  ): Promise<ValidationResult> {
    return this._postJson<any>(
      "/download/data_slicer/validate_features",
      query
    );
  }

  getTDASummaryTable(): Promise<TDASummaryTable> {
    return this._fetch<TDASummaryTable>("/tda/summary_table");
  }

  getTDAInterpretableModelImageUrl(
    gene_label: string,
    dataset: string
  ): string {
    const params = {
      gene_label,
      dataset,
    };
    return this._getFileUrl(`/tda/interpretable_model?${encodeParams(params)}`);
  }

  getTDATableDownloadUrl(): string {
    return this._getFileUrl(`/tda/table_download`);
  }

  getTDATableAsOriginalCSV() {
    return this._fetchText("/tda/table_download");
  }

  getCompoundDashboardSummaryTable(
    datasetId: string
  ): Promise<CompoundSummaryTableRaw> {
    return this._fetch<CompoundSummaryTableRaw>(
      `/compound_dashboard/summary_table/${datasetId}`
    );
  }

  getEntitySummary(
    entity_id: number,
    dep_enum_name: string,
    size_biom_enum_name: string,
    color: string
  ): Promise<EntitySummaryResponse> {
    const params = {
      entity_id,
      dep_enum_name,
      size_biom_enum_name: size_biom_enum_name || "none",
      color: color || "none",
    };
    return this._fetch<EntitySummaryResponse>(
      `/partials/entity_summary?${encodeParams(params)}`
    );
  }

  getEntitySummaryDownload(
    entity_id: number,
    dep_enum_name: string,
    size_biom_enum_name: string,
    color: string
  ) {
    const params = {
      entity_id,
      dep_enum_name,
      size_biom_enum_name: size_biom_enum_name || "none",
      color: color || "none",
    };
    const url = `/partials/entity_summary/download?${encodeParams(params)}`;
    const fullUrl = this.urlPrefix + url;
    return fullUrl;
  }

  getConstellationGraphs(
    resultId: string,
    uploadFile: File | null,
    similarityMeasure: string,
    nFeatures: number,
    connectivity: ConnectivityValue,
    topSelectedFeature: TopFeatureValue
  ): Promise<ConstellationGraphInputs> {
    const span = this.startSpan("getConstellationGraphs");
    return this._postMultipart<ConstellationGraphInputs>(
      `/constellation/graph`,
      {
        resultId,
        uploadFile,
        similarityMeasure,
        nFeatures,
        connectivity,
        topSelectedFeature,
      }
    ).finally(() => {
      span.end();
    });
  }

  getPredictabilityDownloadUrl(entityType: EntityType) {
    return `${this.urlPrefix}/${entityType}/predictability_files`;
  }

  // Only exist to match bbAPI. These should never be used with depmap.
  getBreadboxDatasets = (): Promise<BreadboxDataset[]> => {
    return Promise.reject(Error("Wrong api used. Check ApiContext"));
  };

  getBreadboxUser = (): Promise<string> => {
    return Promise.reject(Error("Wrong api used. Check ApiContext"));
  };

  /* eslint-disable  @typescript-eslint/no-unused-vars */
  getMetadata = (label: string): Promise<any> => {
    return Promise.reject(Error("Wrong api used. Check ApiContext"));
  };

  postFileUpload(fileArgs: { file: File | Blob }) {
    return Promise.reject(Error("Wrong api used. Check ApiContext"));
  }

  postDatasetUpload(datasetParams: DatasetParams): Promise<any> {
    return Promise.reject(Error("Wrong api used. Check ApiContext"));
  }

  /* eslint-disable  @typescript-eslint/no-unused-vars */
  postDataset = (
    datasetArgs: any,
    allowed_values: string[]
  ): Promise<BreadboxDataset> => {
    return Promise.reject(Error("Wrong api used. Check ApiContext"));
  };

  deleteDatasets = (id: string): Promise<any> => {
    return Promise.reject(Error("Wrong api used. Check ApiContext"));
  };

  updateDataset(
    datasetId: string,
    datasetToUpdate: DatasetUpdateArgs
  ): Promise<BreadboxDataset> {
    return Promise.reject(Error("Wrong api used. Check ApiContext"));
  }

  getGroups = (writeAccess: boolean = false): Promise<Group[]> => {
    return Promise.reject(Error("Wrong api used. Check ApiContext"));
  };

  // NOTE: These endpoints for feature type and sample type should not be used because they are deprecated
  getSampleTypes = () => {
    return Promise.reject(Error("Wrong api used. Check ApiContext"));
  };

  postSampleType = (sampleTypeArgs: any) => {
    return Promise.reject(Error("Wrong api used. Check ApiContext"));
  };

  updateSampleType = (sampleTypeArgs: any) => {
    return Promise.reject(Error("Wrong api used. Check ApiContext"));
  };

  deleteSampleType = (name: string) => {
    return Promise.reject(Error("Wrong api used. Check ApiContext"));
  };

  getFeatureTypes = () => {
    return Promise.reject(Error("Wrong api used. Check ApiContext"));
  };

  postFeatureType = (featureTypeArgs: any) => {
    return Promise.reject(Error("Wrong api used. Check ApiContext"));
  };

  updateFeatureType = (featureTypeArgs: any) => {
    return Promise.reject(Error("Wrong api used. Check ApiContext"));
  };

  deleteFeatureType = (name: string) => {
    return Promise.reject(Error("Wrong api used. Check ApiContext"));
  };
  // NOTE: THe above endpoints for feature type and sample type are deprecated and should not be used.
  // Endpoints with URI prefix /types/dimensions should be used instead

  getDimensionTypes = (): Promise<DimensionType[]> => {
    return Promise.reject(Error("Wrong api used. Check ApiContext"));
  };

  postDimensionType = (
    dimTypeArgs: DimensionTypeAddArgs
  ): Promise<DimensionType> => {
    return Promise.reject(Error("Wrong api used. Check ApiContext"));
  };

  updateDimensionType = (
    dimTypeName: string,
    dimTypeArgs: DimensionTypeUpdateArgs
  ): Promise<DimensionType> => {
    return Promise.reject(Error("Wrong api used. Check ApiContext"));
  };

  deleteDimensionType = (name: string) => {
    return Promise.reject(Error("Wrong api used. Check ApiContext"));
  };

  searchDimensions({
    prefix,
    substring,
    type_name,
    limit,
  }: SearchDimenionsRequest) {
    const params = {
      prefix,
      substring,
      type_name,
      limit: Number.isFinite(limit) ? limit : 100,
    };

    return this._fetch<SearchDimenionsResponse>(
      `/breadbox/datasets/dimensions/?${encodeParams(params)}`
    );
  }

  getDataTypesAndPriorities = (): Promise<InvalidPrioritiesByDataType> => {
    return Promise.reject(Error("Wrong api used. Check ApiContext"));
  };

  postGroup = (groupArgs: GroupArgs): Promise<Group> => {
    return Promise.reject(Error("Wrong api used. Check ApiContext"));
  };

  deleteGroup = (id: string) => {
    return Promise.reject(Error("Wrong api used. Check ApiContext"));
  };

  postGroupEntry = (
    groupId: string,
    groupEntryArgs: GroupEntryArgs
  ): Promise<GroupEntry> => {
    return Promise.reject(Error("Wrong api used. Check ApiContext"));
  };

  deleteGroupEntry = (groupEntryId: string) => {
    return Promise.reject(Error("Wrong api used. Check ApiContext"));
  };

  fetchAssociations(sliceQuery: SliceQuery) {
    return Promise.reject(Error("Wrong api used. Check ApiContext"));
  }
}
