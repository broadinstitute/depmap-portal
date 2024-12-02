import {
  AssociationAndCheckbox,
  AddDatasetOneRowArgs,
  Catalog,
  PlotFeatures,
} from "@depmap/interactive";
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
import { isNullOrUndefined } from "util";
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
  CellLineDescriptionData,
} from "src/cellLine/models/types";
import TopFeatureValue from "src/celfie/models/celfie";
import { Trace, ActiveSpan, NoOpSpan } from "src/trace";
import {
  ContextInfo,
  ContextSummary,
  DataType,
  ContextAnalysisTableType,
  getDataTypeColorCategoryFromDataTypeValue,
  Summary,
  ContextPlotBoxData,
  ContextExplorerDatasets,
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

  getFeaturePlot(
    features: string[],
    groupBy: string,
    filter: string,
    computeLinearFit: boolean
  ): Promise<PlotFeatures> {
    const params: any = {
      features,
      groupBy,
      filter,
      computeLinearFit,
    };
    if (!isNullOrUndefined(groupBy)) {
      params.groupBy = groupBy;
    }
    return this._fetch<PlotFeatures>(
      `/interactive/api/get-features?${encodeParams(params)}`
    );
  }

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

  getGeneHasRepHub(geneSymbol: string): Promise<{ hasRepHub: boolean }> {
    return this._fetch<{ hasRepHub: boolean }>(
      `/gene/has_rephub/${geneSymbol}`
    );
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

  getDatasets(): Promise<Array<Dataset>> {
    return this._fetch<Dataset[]>("/interactive/api/getDatasets");
  }

  postCustomTaiga = (config: UserUploadArgs): Promise<UploadTask> => {
    return this._postJson<UploadTask>(
      "/interactive/api/dataset/add-taiga",
      config
    );
  };

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

  uploadPrivateDataset(data: UserUploadArgs): Promise<UploadTask> {
    const queryParams = {
      displayName: data.displayName,
      units: data.units,
      ownerId: data.selectedGroup,
      transposed: data.transposed,
      dataType: data.selectedDataType,
    };
    return this._postMultipart<UploadTask>(
      `/api/upload/private?${encodeParams(queryParams)}`,
      { uploadFile: data.uploadFile }
    );
  }

  getPrivateDatasetUploadStatus(taskId: string): Promise<UploadTask> {
    return this._fetch(`/private_dataset/upload_status/${taskId}`);
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

  getDownloads(): Promise<Downloads> {
    return this._fetch<Downloads>("/download/api/downloads");
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

  getCellLineDescriptionTileData(
    modelId: string
  ): Promise<CellLineDescriptionData> {
    return this._fetch<CellLineDescriptionData>(
      `/cell_line/description_tile/${modelId}`
    );
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

  getContextPath(selectedCode: string): Promise<string[]> {
    const params = {
      selected_code: selectedCode,
    };

    return this._fetch<string[]>(
      `/api/context_explorer/context_path?${encodeParams(params)}`
    );
  }
  getContextExplorerContextInfo(): Promise<ContextInfo> {
    return this._fetch<ContextInfo>(`/api/context_explorer/context_info`);
  }

  getContextExplorerDoseResponsePoints(
    datasetName: string,
    subtypeCode: string,
    compoundLabel: string,
    selectedLevel: number
  ): Promise<DoseCurveData> {
    const params = {
      dataset_name: datasetName,
      subtype_code: subtypeCode,
      entity_full_label: compoundLabel,
      level: selectedLevel,
      out_group_type: "All Others",
    };

    return this._fetch<DoseCurveData>(
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
      out_group_type: "All Others",
      entity_type,
      dataset_name,
    };

    return this._fetch<ContextAnalysisTableType>(
      `/api/context_explorer/analysis_data?${encodeParams(params)}`
    );
  }

  getContextExplorerBoxPlotData(
    selected_context: string,
    dataset_name: ContextExplorerDatasets,
    top_context: string,
    out_group_type: string,
    entity_type: string,
    entity_full_label: string,
    fdr: number[],
    abs_effect_size: number[],
    frac_dep_in: number[]
  ): Promise<ContextPlotBoxData> {
    const params: any = {
      selected_context,
      dataset_name,
      top_context,
      out_group_type: "All Others",
      entity_type,
      entity_full_label,
      fdr,
      abs_effect_size,
      frac_dep_in,
    };

    return this._fetch<ContextPlotBoxData>(
      `/api/context_explorer/context_box_plot_data?${encodeParams(params)}`
    );
  }

  async getContextDataAvailability(): Promise<ContextSummary> {
    const boolSummary = await this._fetch<Summary>(
      "/api/context_explorer/context_summary"
    );

    const dataAvailVals = boolSummary.values.map(
      (datatypeVals: boolean[], index: number) =>
        datatypeVals.map((val: boolean) => {
          const dType =
            DataType[boolSummary.data_types[index] as keyof typeof DataType];
          return getDataTypeColorCategoryFromDataTypeValue(dType, val);
        })
    );

    return {
      all_depmap_ids: boolSummary.all_depmap_ids,
      data_types: boolSummary.data_types,
      // The original True/False values returned from the backend are
      // mapped to color category integers. The integer maps to Heatmap.tsx's
      // color scale.
      values: dataAvailVals,
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

  getVectorCatalogChildren(
    catalog: Catalog,
    id: string,
    prefix = ""
  ): Promise<any> {
    // chances are, you shouldn't be using this. use getVectorCatalogOptions in vectorCatalogApi, which wraps around this
    const params = {
      catalog,
      id,
      prefix,
      limit: 1000,
    };
    return this._fetch<any>(
      `/vector_catalog/data/catalog/children?${encodeParams(params)}`
    );
  }

  getVectorCatalogPath(catalog: Catalog, id: string): Promise<Array<any>> {
    // chances are, you shouldn't be using this. use getVectorCatalogPath in vectorCatalogApi, which wraps around this
    const params = {
      catalog,
      id,
    };
    return this._fetch<Array<any>>(
      `/vector_catalog/data/catalog/path?${encodeParams(params)}`
    );
  }

  getVector(id: string): Promise<any> {
    return this._fetch<Array<any>>(
      `/vector_catalog/data/vector/${encodeURIComponent(id)}`
    );
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

  deletePrivateDatasets(dataset_ids: Array<string>) {
    return this._deleteJson("/private_dataset/delete", { dataset_ids });
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

  getGroups = (): Promise<Group[]> => {
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
}
