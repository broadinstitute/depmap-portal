import qs from "qs";
import omit from "lodash.omit";
import { ComputeResponseResult } from "@depmap/compute";
import { isCompleteDimension, isPartialSliceId } from "@depmap/data-explorer-2";
import {
  DataExplorerAnonymousContext,
  DataExplorerContext,
  DataExplorerDatasetDescriptor,
  DataExplorerFilters,
  DataExplorerMetadata,
  DataExplorerPlotConfigDimension,
  DataExplorerPlotResponse,
  FilterKey,
  LinRegInfo,
} from "@depmap/types";

function fetchUrlPrefix() {
  const element = document.getElementById("webpack-config");

  if (element) {
    const webpackConfig = JSON.parse(element!.textContent as string);
    return webpackConfig.rootUrl;
  }

  return "/";
}

const urlPrefix = `${fetchUrlPrefix().replace(/^\/$/, "")}/data_explorer_2`;
const fetchJsonCache: Record<string, Promise<unknown> | null> = {};

const fetchJson = async <T>(
  url: string,
  transformResponse: (o: object) => T = (id) => id as T
): Promise<T> => {
  if (!fetchJsonCache[url]) {
    fetchJsonCache[url] = new Promise((resolve, reject) => {
      fetch(urlPrefix + url, { credentials: "include" })
        .then((response) => {
          return response.json().then((body) => {
            if (response.status >= 200 && response.status < 300) {
              const result = transformResponse(body);
              fetchJsonCache[url] = Promise.resolve(result);
              resolve(result);
            } else {
              fetchJsonCache[url] = null;
              reject(body);
            }
          });
        })
        .catch((e) => {
          fetchJsonCache[url] = null;
          reject(e);
        });
    });
  }

  return fetchJsonCache[url] as Promise<T>;
};

const postJson = async <T>(url: string, obj: unknown): Promise<T> => {
  const json = JSON.stringify(obj);
  const cacheKey = `${url}-${json}`;

  if (!fetchJsonCache[cacheKey]) {
    fetchJsonCache[cacheKey] = new Promise((resolve, reject) => {
      fetch(urlPrefix + url, {
        credentials: "include",
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: json,
      })
        .then((response) => {
          return response.json().then((body) => {
            if (response.status >= 200 && response.status < 300) {
              fetchJsonCache[cacheKey] = Promise.resolve(body);
              resolve(body);
            } else {
              fetchJsonCache[cacheKey] = null;
              reject(body);
            }
          });
        })
        .catch((e) => {
          fetchJsonCache[cacheKey] = null;
          reject(e);
        });
    });
  }

  return fetchJsonCache[cacheKey] as Promise<T>;
};

export function fetchDatasetsByIndexType() {
  return fetchJson<Record<string, DataExplorerDatasetDescriptor[]>>(
    `/datasets_by_index_type`
  );
}

export async function fetchAnalysisResult(
  taskId: string
): Promise<ComputeResponseResult | null> {
  return fetchJson(`/../api/task/${taskId}`, (task) => {
    const { state, result } = task as {
      state: string;
      result: ComputeResponseResult;
    };

    // WORKAROUND: The task should have a `state` of "SUCCESS" because the
    // Custom Analysis page only redirects to Data Explorer 2 after having
    // waited for that condition.
    // However, a request for a task will never fail. An unknown task actually
    // returns a "PENDING" status  ¯\_(ツ)_/¯
    if (state === "PENDING") {
      return null;
    }

    return result || null;
  });
}

export async function fetchAssociations(
  dataset_id: string,
  slice_label: string
): Promise<{
  associatedDatasets: string[];
  datasetLabel: string;
  data: {
    correlation: number;
    other_dataset: string;
    other_entity_label: string;
    other_entity_type: string;
    other_slice_id: string;
  }[];
}> {
  const urlLibEncode = (s: string) => {
    return encodeURIComponent(s).replace(
      /[()*!']/g,
      (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`
    );
  };

  const sliceId = `slice/${urlLibEncode(dataset_id)}/${slice_label}/label`;
  const query = `x=${encodeURIComponent(sliceId)}`;

  return fetchJson(`/../interactive/api/associations?${query}`);
}

export async function evaluateLegacyContext(
  context: DataExplorerContext | DataExplorerAnonymousContext
): Promise<string[]> {
  return postJson<string[]>("/context/labels", { context });
}

export async function fetchCorrelation(
  index_type: string,
  dimensions: Record<string, DataExplorerPlotConfigDimension>,
  filters?: DataExplorerFilters,
  use_clustering?: boolean
): Promise<DataExplorerPlotResponse> {
  const json = {
    index_type,
    dimensions,
    filters: filters || undefined,
    use_clustering: Boolean(use_clustering),
  };

  return postJson("/get_correlation", json);
}

export function fetchDatasetDetails(dataset_id: string) {
  const query = qs.stringify({ dataset_id });

  return fetchJson<{
    file: {
      downloadUrl: string;
      fileDescription: string;
      fileName: string;
      retractionOverride: string;
      sources: string[];
      summaryStats: { label: string; value: number }[];
      taigaUrl: string;
      terms: string;
    };
    release: { releaseName: string };
    termsDefinitions: Record<string, string>;
  }>(`/dataset_details?${query}`);
}

// This is only used by DimensionSelect to show a special UI for the
// "compound_experiment" dimension type. After migrating everything to
// Breadbox, that feature type will be phased out and we can remove this.
export function fetchDatasetsMatchingContextIncludingEntities(
  context: DataExplorerAnonymousContext
): Promise<
  {
    dataset_id: string;
    dataset_label: string;
    dimension_labels: string[];
  }[]
> {
  return postJson("/context/datasets", { context });
}

export function fetchDimensionLabels(
  dimension_type: string
): Promise<{
  labels: string[];
  aliases: {
    label: string;
    slice_id: string;
    values: string[];
  }[];
}> {
  const query = qs.stringify({ dimension_type });

  return fetchJson(`/dimension_labels?${query}`);
}

export function fetchDimensionLabelsOfDataset(
  dimension_type: string | null,
  dataset_id: string
): Promise<{
  labels: string[];
  aliases: {
    label: string;
    slice_id: string;
    values: string[];
  }[];
}> {
  const query = qs.stringify({ dimension_type, dataset_id });

  return fetchJson(`/dimension_labels_of_dataset?${query}`);
}

type DataType = string;
type DatasetIndex = number;
type DimensionLabel = string;

export function fetchDimensionLabelsToDatasetsMapping(
  dimension_type: string
): Promise<{
  dataset_ids: string[];
  dataset_labels: string[];
  units: Record<string, DatasetIndex[]>;
  data_types: Record<DataType, DatasetIndex[]>;
  dimension_labels: Record<DimensionLabel, DatasetIndex[]>;
  aliases: {
    label: string;
    slice_id: string;
    values: string[];
  }[];
}> {
  const query = qs.stringify({ dimension_type });

  return fetchJson(`/dimension_labels_to_datasets_mapping?${query}`);
}

export async function fetchGeneTeaEnrichment(
  genes: string[],
  limit: number | null
): Promise<{
  term: string[];
  synonyms: string[][];
  coincident: string[][];
  fdr: number[];
  matchingGenes: string[][];
  total: number;
}> {
  const query = qs.stringify(
    {
      gene_list: genes,
      remove_overlapping: "true",
      n: limit || -1,
      model: "v2",
    },
    { arrayFormat: "repeat" }
  );

  interface RawResponse {
    // TODO: Give the user feedback when some genes are invalid.
    invalid_genes: string[];
    total_n_enriched_terms: number;
    enriched_terms: {
      Term: string[];
      // semicolon separated strings
      Synonyms: (string | null)[];
      // semicolon separated strings
      "Coincident Terms": (string | null)[];
      FDR: number[];
      // Gene lists are just space-separated strings like "ADSL CAD UMPS"
      "Matching Genes in List": string[];
    };
  }

  const transformResponse = (body: RawResponse) => {
    // `enriched_terms` can be null when there are no relevant terms. We'll
    // return a wrapper object to distinguish this from some kind of error.
    if (body.enriched_terms === null) {
      return {
        term: [],
        synonyms: [],
        coincident: [],
        fdr: [],
        matchingGenes: [],
        total: 0,
      };
    }

    const et = body.enriched_terms;

    return {
      term: et.Term,
      fdr: et.FDR,
      total: body.total_n_enriched_terms,
      synonyms: et.Synonyms.map((list) => list?.split(";") || []),
      coincident: et["Coincident Terms"].map((list) => list?.split(";") || []),
      matchingGenes: et["Matching Genes in List"].map((geneList) => {
        return geneList.split(" ");
      }),
    };
  };

  return fetchJson(
    `/../../genetea-api/enriched-terms/?${query}`,
    transformResponse as (o: object) => ReturnType<typeof transformResponse>
  );
}

export async function fetchGeneTeaTermContext(
  term: string,
  genes: string[]
): Promise<Record<string, string>> {
  const query = qs.stringify(
    { term, gene_list: genes, model: "v2", html: true },
    { arrayFormat: "repeat" }
  );

  const transformResponse = (body: {
    message?: string;
    context: Record<string, string>;
  }) => {
    if (body.message) {
      throw new Error(body.message);
    }

    return body.context;
  };

  return fetchJson(
    `/../../genetea-api/context/?${query}`,
    transformResponse as (o: object) => Record<string, string>
  );
}

export async function fetchLinearRegression(
  index_type: string,
  dimensions: Record<string, DataExplorerPlotConfigDimension>,
  filters?: DataExplorerFilters,
  metadata?: DataExplorerMetadata
): Promise<LinRegInfo[]> {
  const isValidMetadata =
    metadata &&
    metadata.color_property &&
    !isPartialSliceId(metadata.color_property.slice_id);

  const json = {
    index_type,

    dimensions: isCompleteDimension(dimensions.color)
      ? dimensions
      : omit(dimensions, "color"),

    metadata: isValidMetadata ? metadata : null,
    filters,
  };

  return postJson("/linear_regression", json);
}

export async function fetchMetadataColumn(
  slice_id: string
): Promise<{
  slice_id: string;
  label: string;
  indexed_values: Record<string, string>;
}> {
  return postJson("/get_metadata", { metadata: { slice_id } });
}

export async function fetchMetadataSlices(
  dimension_type: string
): Promise<
  Record<
    string,
    {
      name: string;
      valueType: "categorical" | "list_strings";
      isHighCardinality?: boolean;
      isPartialSliceId?: boolean;
      sliceTypeLabel?: string;
    }
  >
> {
  const query = `dimension_type=${encodeURIComponent(dimension_type)}`;

  return fetchJson(`/metadata_slices?${query}`);
}

// Makes several concurrent requests and stitches them togther into a
// DataExplorerPlotResponse.
export async function fetchPlotDimensions(
  index_type: string,
  dimensions: Record<string, DataExplorerPlotConfigDimension>,
  filters?: DataExplorerFilters,
  metadata?: DataExplorerMetadata
): Promise<DataExplorerPlotResponse> {
  const dimensionKeys = Object.keys(dimensions).filter((key) => {
    return isCompleteDimension(dimensions[key]);
  });

  const filterKeys = Object.keys(filters || {}) as FilterKey[];

  const metadataKeys = Object.keys(metadata || {}).filter((key) => {
    return !isPartialSliceId(metadata![key].slice_id);
  });

  const responses = await Promise.all(
    [
      postJson("/get_shared_index", {
        index_type,
        dataset_ids: [
          ...new Set(dimensionKeys.map((key) => dimensions[key].dataset_id)),
        ].sort(),
      }),

      ...dimensionKeys.map((key) => {
        return postJson("/get_dimension", {
          index_type,
          dimension: dimensions[key],
        }).then((payload) => ({ property: "dimensions", payload, key }));
      }),

      ...filterKeys.map((key) => {
        return postJson("/get_filter", {
          filter: filters![key],
        }).then((payload) => ({ property: "filters", payload, key }));
      }),

      ...metadataKeys.map((key) => {
        return postJson("/get_metadata", { metadata: metadata![key] }).then(
          (payload) => ({
            property: "metadata",
            payload,
            key,
          })
        );
      }),
    ].filter(Boolean)
  );

  const { index_labels, index_aliases } = responses[0] as {
    index_labels: string[];
    index_aliases: DataExplorerPlotResponse["index_aliases"];
  };

  const out = {
    index_type,
    index_labels,
    index_aliases,
    linreg_by_group: [],
    dimensions: {} as Record<string, unknown>,
    filters: {} as Record<string, unknown>,
    metadata: {} as Record<string, unknown>,
  };

  responses.slice(1).forEach((value) => {
    const { payload, property, key } = value as {
      payload: { indexed_values: Record<string, unknown> };
      property: "dimensions" | "filters" | "metadata";
      key: string;
    };

    const values = [];
    const { indexed_values, ...rest } = payload;
    const defaultValue = property === "filters" ? false : null;

    for (let i = 0; i < index_labels.length; i += 1) {
      const label = index_labels[i];
      values[i] = indexed_values[label] ?? defaultValue;
    }

    out[property][key] = { ...rest, values };
  });

  return Promise.resolve((out as unknown) as DataExplorerPlotResponse);
}

export async function fetchWaterfall(
  index_type: string,
  dimensions: Record<string, DataExplorerPlotConfigDimension>,
  filters?: DataExplorerFilters,
  metadata?: DataExplorerMetadata
): Promise<DataExplorerPlotResponse> {
  const isValidMetadata =
    metadata &&
    metadata.color_property &&
    !isPartialSliceId(metadata.color_property.slice_id);

  const json = {
    index_type,

    dimensions: isCompleteDimension(dimensions.color)
      ? dimensions
      : omit(dimensions, "color"),

    metadata: isValidMetadata ? metadata : null,
    filters,
  };

  return postJson("/get_waterfall", json);
}

export async function fetchContextSummary(
  context: DataExplorerContext | DataExplorerAnonymousContext
): Promise<{
  num_matches: number;
  num_candidates: number;
}> {
  return postJson("/context/summary", { context });
}

export function fetchUniqueValuesOrRange(
  slice_id: string
): Promise<
  | {
      value_type: "categorical";
      unique_values: string[];
    }
  | {
      value_type: "continuous";
      min: number;
      max: number;
    }
> {
  const query = qs.stringify({ slice_id });

  return fetchJson(`/unique_values_or_range?${query}`);
}
