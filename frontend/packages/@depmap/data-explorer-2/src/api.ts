import qs from "qs";
import omit from "lodash.omit";
import stableStringify from "json-stable-stringify";
import { ComputeResponseResult } from "@depmap/compute";
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
import getContextHash from "./utils/get-context-hash";
import {
  isCompleteDimension,
  isPartialSliceId,
  urlLibEncode,
} from "./utils/misc";

function fetchUrlPrefix() {
  // HACK: Detect when Elara is being served behind Depmap portal proxy
  if (window.location.pathname.includes("/breadbox/elara")) {
    return window.location.pathname.replace(/\/elara\/.*$/, "");
  }

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

export async function fetchCorrelation(
  index_type: string,
  dimensions: Record<string, DataExplorerPlotConfigDimension>,
  filters?: DataExplorerFilters,
  use_clustering?: boolean
) {
  const json = {
    index_type,
    dimensions,
    filters: filters || undefined,
    use_clustering: Boolean(use_clustering),
  };

  return postJson<DataExplorerPlotResponse>("/get_correlation", json);
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

  return postJson<DataExplorerPlotResponse>("/get_waterfall", json);
}

export function fetchDatasetsByIndexType() {
  return fetchJson<Record<string, DataExplorerDatasetDescriptor[]>>(
    `/datasets_by_index_type`
  );
}

export async function fetchContextLabels(
  context: DataExplorerContext | DataExplorerAnonymousContext
): Promise<string[]> {
  return postJson<string[]>("/context/labels", { context });
}

export interface ContextDatasetsResponse {
  dataset_id: string;
  dataset_label: string;
  dimension_labels: string[];
}

export function fetchDatasetsMatchingContextIncludingEntities(
  context: DataExplorerContext | DataExplorerAnonymousContext
): Promise<ContextDatasetsResponse[]> {
  return postJson<ContextDatasetsResponse[]>("/context/datasets", { context });
}

export interface ContextSummaryResponse {
  num_matches: number;
  num_candidates: number;
}

export async function fetchContextSummary(
  context: DataExplorerContext | DataExplorerAnonymousContext
): Promise<ContextSummaryResponse> {
  return postJson<ContextSummaryResponse>("/context/summary", { context });
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

export function fetchUniqueValuesOrRange(slice_id: string) {
  const query = qs.stringify({ slice_id });

  type CategoricalResponse = {
    value_type: "categorical";
    unique_values: string[];
  };

  type ContinuousResponse = {
    value_type: "continuous";
    min: number;
    max: number;
  };

  return fetchJson<CategoricalResponse | ContinuousResponse>(
    `/unique_values_or_range?${query}`
  );
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

export interface GeneTeaEnrichedTerms {
  term: string[];
  synonyms: string[][];
  coincident: string[][];
  fdr: number[];
  matchingGenes: string[][];
  total: number;
}

type GeneName = string;
type SentenceContainingTerm = string;
export type GeneTeaTermContext = Record<GeneName, SentenceContainingTerm>;

export async function fetchGeneTeaEnrichment(
  genes: string[],
  limit: number | null
): Promise<GeneTeaEnrichedTerms> {
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
): Promise<GeneTeaTermContext> {
  const query = qs.stringify(
    { term, gene_list: genes, model: "v2", html: true },
    { arrayFormat: "repeat" }
  );

  const transformResponse = (body: {
    message?: string;
    context: GeneTeaTermContext;
  }) => {
    if (body.message) {
      throw new Error(body.message);
    }

    return body.context;
  };

  return fetchJson(
    `/../../genetea-api/context/?${query}`,
    transformResponse as (o: object) => GeneTeaTermContext
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
  const sliceId = `slice/${urlLibEncode(dataset_id)}/${slice_label}/label`;
  const query = `x=${encodeURIComponent(sliceId)}`;

  return fetchJson(`/../interactive/api/associations?${query}`);
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

type SliceId = string;
export type MetadataSlices = Record<
  SliceId,
  {
    name: string;
    valueType: "categorical" | "list_strings";
    isHighCardinality?: boolean;
    isPartialSliceId?: boolean;
    sliceTypeLabel?: string;
  }
>;

export async function fetchMetadataSlices(dimension_type: string) {
  const query = `dimension_type=${encodeURIComponent(dimension_type)}`;

  return fetchJson<MetadataSlices>(`/metadata_slices?${query}`);
}

// *****************************************************************************
// * Context cache                                                             *
// *****************************************************************************
// `persistContext` and `fetchContext` use the browser's cache (instead of our
// makeshift in-memory cache) so the data is persisted across sessions.
// https://developer.mozilla.org/en-US/docs/Web/API/Cache

const CONTEXT_CACHE = "contexts-v1";
const successfullyPersistedContexts = new Set<string>();
// Fall back to using an in-memory cache if the user has caching disabled.
const fallbackInMemoryCache: Record<string, DataExplorerContext> = {};

const getContextUrl = (hash: string) => {
  const prefix = fetchUrlPrefix().replace(/^\/$/, "");
  return `${prefix}/cas/${hash}`;
};

export async function persistContext(
  context: DataExplorerContext
): Promise<string> {
  const hash = await getContextHash(context);

  if (successfullyPersistedContexts.has(hash)) {
    return hash;
  }

  const json = stableStringify(context);
  let cacheSuccess = false;

  try {
    // window.caches.open() will throw an error in Firefox when the user is in
    // "private browsing mode."
    // https://bugzilla.mozilla.org/show_bug.cgi?id=1724607
    // https://support.mozilla.org/en-US/kb/private-browsing-use-firefox-without-history
    const cache = await window.caches.open(CONTEXT_CACHE);

    // Make a fake request/response object that simulates fetchContext() below
    // and store it in the cache for instant retrievable.
    const request = new Request(getContextUrl(hash));
    const blobPart = JSON.stringify({ value: json });
    const blob = new Blob([blobPart], { type: "application/json" });
    const init = { status: 200, statusText: "OK" };
    const response = new Response(blob, init);

    await cache.put(request, response);
    cacheSuccess = true;
  } catch (e) {
    window.console.error("Failed to cache context", e);
    fallbackInMemoryCache[hash] = context;
  }

  const url = `${fetchUrlPrefix().replace(/^\/$/, "")}/cas/`;
  const data = new URLSearchParams();
  data.append("value", json);
  const options = { method: "POST", body: data };

  if (cacheSuccess) {
    // Don't wait for this to finish since we just put a
    // simulated response in the cache. TODO: retry on fail
    fetch(url, options).then((res) => {
      if (res.status >= 200 && res.status < 300) {
        successfullyPersistedContexts.add(hash);
      }
    });
  } else {
    // We were unable to cache so we should wait for the round trip.
    const res = await fetch(url, options);

    if (res.status < 200 || res.status > 299) {
      throw new Error("Bad request");
    } else {
      successfullyPersistedContexts.add(hash);
    }
  }

  return hash;
}

export async function fetchContext(hash: string): Promise<DataExplorerContext> {
  let cache: Cache | undefined;
  let response: Response | undefined;
  const request = new Request(getContextUrl(hash));

  try {
    // window.caches.open() will throw an error in Firefox when the user is in
    // "private browsing mode."
    // https://bugzilla.mozilla.org/show_bug.cgi?id=1724607
    // https://support.mozilla.org/en-US/kb/private-browsing-use-firefox-without-history
    cache = await window.caches.open(CONTEXT_CACHE);
    response = await cache.match(request.clone());
  } catch (e) {
    window.console.error(e);

    if (fallbackInMemoryCache[hash]) {
      return fallbackInMemoryCache[hash];
    }
  }

  // handle cache miss
  if (!response) {
    response = await fetch(request.clone());

    if (cache) {
      await cache.put(request, response.clone());
    }
  }

  if (response.status === 404) {
    throw new Error("Context not found.");
  }

  if (response.status >= 400) {
    throw new Error("Error fetching context.");
  }

  const body = await response.json();
  const context = JSON.parse(body.value);

  if (!cache) {
    fallbackInMemoryCache[hash] = context;
  }

  return context;
}
