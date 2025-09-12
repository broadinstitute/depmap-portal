import qs from "qs";
import { cached, breadboxAPI } from "@depmap/api";
import { ComputeResponseResult } from "@depmap/compute";
import { getUrlPrefix } from "@depmap/globals";
import {
  DataExplorerAnonymousContext,
  DataExplorerContext,
  DataExplorerContextV2,
} from "@depmap/types";
import { isV2Context } from "../../utils/context";

const urlPrefix = `${getUrlPrefix().replace(/^\/$/, "")}/data_explorer_2`;
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

export async function fetchMetadataSlices(
  dimension_type: string
): Promise<
  Record<
    string,
    {
      name: string;
      valueType: "categorical" | "list_strings" | "binary";
      isHighCardinality?: boolean;
      isPartialSliceId?: boolean;
      sliceTypeLabel?: string;
      isLegacy?: boolean;
      isIdColumn?: boolean;
      isLabelColumn?: boolean;
    }
  >
> {
  const query = `dimension_type=${encodeURIComponent(dimension_type)}`;

  return fetchJson(`/metadata_slices?${query}`);
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

export async function fetchLegacyAssociations(
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
  // It's possible that we've been passed a V2 context
  // because this hacky wrapper is not properly typed:
  // https://github.com/broadinstitute/depmap-portal/blob/5b38776/frontend/packages/@depmap/data-explorer-2/src/components/ContextSelector/index.tsx#L6-L15
  // For now we'll detect when this happens and defer to Breadbox.
  // This is only temporary code anyway and will be removed
  // when we sunset all the legacy Portal's DE2 endpoints.
  if (isV2Context(context as any)) {
    const v2Context = (context as unknown) as DataExplorerContextV2;
    const result = await cached(breadboxAPI).evaluateContext(v2Context);

    return v2Context.dimension_type === "depmap_model"
      ? result.ids
      : result.labels;
  }

  return postJson<string[]>("/context/labels", { context });
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
  given_ids: (string | null)[];
  dataset_labels: string[];
  units: Record<string, DatasetIndex[]>;
  data_types: Record<DataType, DatasetIndex[]>;
  dimension_labels: Record<DimensionLabel, DatasetIndex[]>;
  aliases: string[] | null;
}> {
  const query = qs.stringify({ dimension_type });

  return fetchJson(`/dimension_labels_to_datasets_mapping?${query}`);
}

export async function fetchMetadataColumn(
  slice_id: string
): Promise<{
  slice_id: string;
  label: string;
  indexed_values: Record<string, string>;
  value_type: "categorical" | "binary";
}> {
  return postJson("/get_metadata", { metadata: { slice_id } });
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
      value_type: "categorical" | "binary";
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
