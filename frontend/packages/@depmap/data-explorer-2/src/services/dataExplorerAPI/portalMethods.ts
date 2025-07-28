import omit from "lodash.omit";
import { linregress, pearsonr, spearmanr } from "@depmap/statistics";
import {
  DataExplorerDatasetDescriptor,
  DataExplorerFilters,
  DataExplorerMetadata,
  DataExplorerPlotConfigDimension,
  DataExplorerPlotResponse,
  FilterKey,
} from "@depmap/types";
import { isCompleteDimension, isPartialSliceId } from "../../utils/misc";

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

// Legacy metadata did not support the SliceQuery format.
type LegacyDataExplorerMetadata = Record<string, { slice_id: string }>;

function getExtraMetadata(
  index_type: string,
  metadata?: LegacyDataExplorerMetadata
) {
  const extraMetadata = {} as LegacyDataExplorerMetadata;
  // HACK: Always include this info about models so we can show it in hover
  // tips. In the future, we should make it configurable what information is
  // shown there.
  if (index_type === "depmap_model") {
    const primaryDisaseSliceId = "slice/primary_disease/all/label";
    const lineageSliceId = "slice/lineage/1/label";

    if (metadata?.color_property?.slice_id !== primaryDisaseSliceId) {
      extraMetadata.extra1 = {
        slice_id: primaryDisaseSliceId,
      };
    }

    if (metadata?.color_property?.slice_id !== lineageSliceId) {
      extraMetadata.extra2 = {
        slice_id: lineageSliceId,
      };
    }
  }

  return extraMetadata;
}

// Makes several concurrent requests and stitches them togther into a
// DataExplorerPlotResponse.
export async function fetchPlotDimensions(
  index_type: string,
  dimensions: Record<string, DataExplorerPlotConfigDimension>,
  filters?: DataExplorerFilters,
  metadata?: DataExplorerMetadata
): Promise<DataExplorerPlotResponse> {
  // eslint-disable-next-line no-param-reassign
  metadata = {
    ...metadata,
    ...getExtraMetadata(index_type, metadata as LegacyDataExplorerMetadata),
  };

  const dimensionKeys = Object.keys(dimensions).filter((key) => {
    return isCompleteDimension(dimensions[key]);
  });

  const filterKeys = Object.keys(filters || {}) as FilterKey[];

  const metadataKeys = Object.keys(metadata || {}).filter((key) => {
    return !isPartialSliceId(
      (metadata as LegacyDataExplorerMetadata)![key].slice_id
    );
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
  // eslint-disable-next-line no-param-reassign
  metadata = {
    ...metadata,
    ...getExtraMetadata(index_type, metadata as LegacyDataExplorerMetadata),
  };

  const json = {
    index_type,

    dimensions: isCompleteDimension(dimensions.color)
      ? dimensions
      : omit(dimensions, "color"),

    metadata,
    filters,
  };

  return postJson("/get_waterfall", json);
}

// Historically, all computations happened on the backend and were cached
// according to the corresponding endpoint. Many of those calculations now happen
// on the frontend. This function is used to cache those results.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const memoize = <T>(computeResponse: (...args: any[]) => Promise<T>) => {
  const cache: Record<string, Promise<T>> = {};

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return async (...args: any[]): Promise<T> => {
    const cacheKey = JSON.stringify(args);

    if (!cache[cacheKey]) {
      cache[cacheKey] = computeResponse(...args);
    }

    return cache[cacheKey] as Promise<T>;
  };
};

export const fetchLinearRegression = memoize(
  async (
    index_type: string,
    dimensions: Record<string, DataExplorerPlotConfigDimension>,
    filters?: DataExplorerFilters,
    metadata?: DataExplorerMetadata
  ) => {
    const data = await fetchPlotDimensions(
      index_type,
      dimensions,
      filters,
      metadata
    );

    const xs = data.dimensions.x!.values;
    const ys = data.dimensions.y!.values;
    const visible = data.filters?.visible?.values || xs.map(() => true);
    let categories: (string | number | null)[] = xs.map(() => null);

    if (data.metadata?.color_property) {
      categories = data.metadata.color_property.values;
    }

    if (data.filters?.color1 || data.filters?.color2) {
      const name1 = data.filters?.color1?.name || null;
      const name2 = data.filters?.color2?.name || null;
      const color1 = data.filters?.color1?.values || xs.map(() => false);
      const color2 = data.filters?.color2?.values || xs.map(() => false);

      categories = xs.map((_, i) => {
        if (color1[i] && color2[i]) {
          return `Both (${name1} & ${name2})`;
        }

        if (color1[i] || color2[i]) {
          return color1[i] ? name1 : name2;
        }

        return null;
      });
    }

    const compareNullLast = (
      a: typeof categories[number],
      b: typeof categories[number]
    ) => {
      if (a === b) {
        return 0;
      }

      if (a === null) {
        return 1;
      }

      if (b === null) {
        return -1;
      }

      return a < b ? -1 : 1;
    };

    return [...new Set(categories)].sort(compareNullLast).map((category) => {
      const x: number[] = [];
      const y: number[] = [];

      for (let i = 0; i < xs.length; i += 1) {
        if (
          visible[i] &&
          category === categories[i] &&
          Number.isFinite(xs[i]) &&
          Number.isFinite(ys[i])
        ) {
          x.push(xs[i]);
          y.push(ys[i]);
        }
      }

      const pearson = pearsonr(x, y);
      const spearman = spearmanr(x, y);
      const regression = linregress(x, y);

      return {
        group_label: category as string | null,
        number_of_points: x.length,
        pearson: pearson.statistic,
        spearman: spearman.statistic,
        slope: regression.slope,
        intercept: regression.intercept,
        p_value: regression.pvalue,
      };
    });
  }
);
