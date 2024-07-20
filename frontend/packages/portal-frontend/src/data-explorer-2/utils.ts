import qs from "qs";
import pako from "pako";
import omit from "lodash.omit";
import { Base64 } from "js-base64";
import stableStringify from "json-stable-stringify";
import {
  contextsMatch,
  fetchContext,
  fetchDatasetsByIndexType,
  isCompleteDimension,
  isContextAll,
  isNegatedContext,
  isPartialSliceId,
  negateContext,
  persistContext,
} from "@depmap/data-explorer-2";
import {
  hasSomeShorthandParams,
  omitShorthandParams,
  parseShorthandParams,
} from "src/data-explorer-2/query-string-parser";
import {
  ContextPath,
  DataExplorerContext,
  DataExplorerFilters,
  DataExplorerPlotConfig,
  DataExplorerPlotConfigDimension,
  DimensionKey,
  FilterKey,
  PartialDataExplorerPlotConfig,
  StoredContexts,
} from "@depmap/types";

export function isCompletePlot(
  plot?: PartialDataExplorerPlotConfig | null
): plot is DataExplorerPlotConfig {
  if (!plot) {
    return false;
  }

  const { plot_type, index_type, dimensions } = plot;

  if (!plot_type || !index_type || !dimensions) {
    return false;
  }

  const numAxisDimensions = ({
    density_1d: 1,
    waterfall: 1,
    scatter: 2,
    correlation_heatmap: 1,
  } as Record<string, number>)[plot_type];

  return (
    Object.keys(dimensions).length >= numAxisDimensions &&
    (["x", "y"] as DimensionKey[])
      .slice(0, numAxisDimensions)
      .every((dimensionKey) => {
        const dimension = plot.dimensions![dimensionKey];

        return isCompleteDimension(
          dimension as Partial<DataExplorerPlotConfigDimension>
        );
      })
  );
}

export const defaultContextName = (numEntities: number) => {
  return ["(", numEntities, " selected", ")"].join("");
};

export function toRelatedPlot(
  plot: DataExplorerPlotConfig,
  selectedLabels: Set<string>
): DataExplorerPlotConfig {
  const numDimensions = Math.min(selectedLabels.size, 2);
  const entity_labels = [...selectedLabels];

  // correlation_heatmap -> any
  // Linking from a correlation heatmap is weird. We don't want to flip the
  // index_type and the index_labels actually match the entity_type.
  if (plot.plot_type === "correlation_heatmap") {
    const { index_type } = plot;
    const { dataset_id, entity_type } = plot.dimensions
      .x as DataExplorerPlotConfigDimension;

    const filters: DataExplorerFilters = {};
    let color_by: DataExplorerPlotConfig["color_by"];

    if (
      plot.filters?.distinguish1 &&
      !isContextAll(plot.filters?.distinguish1)
    ) {
      color_by = "context";
      filters.color1 = plot.filters?.distinguish1;
    }

    if (
      plot.filters?.distinguish2 &&
      !isContextAll(plot.filters?.distinguish2)
    ) {
      color_by = "context";
      filters.color2 = plot.filters?.distinguish2;
    }

    return {
      plot_type: numDimensions === 1 ? "density_1d" : "scatter",
      index_type,
      ...(color_by && { color_by }),
      show_regression_line: true,
      dimensions: ["x", "y"].slice(0, numDimensions).reduce(
        (dimensions, dimensionKey, index) => ({
          ...dimensions,
          [dimensionKey]: {
            entity_type,
            axis_type: "entity",
            dataset_id,
            context: {
              name: entity_labels[index],
              context_type: entity_type,
              expr: { "==": [{ var: "entity_label" }, entity_labels[index]] },
            },
            aggregation: "first",
          },
        }),
        {}
      ),
      ...(Object.keys(filters).length > 0 && { filters }),
    };
  }

  const index_type = plot.dimensions.x!.entity_type;
  const { dataset_id } = plot.dimensions.x as DataExplorerPlotConfigDimension;
  const entity_type = plot.index_type;

  // { density_1d, waterfall, scatter } -> correlation_heatmap
  if (selectedLabels.size > 2) {
    const context = {
      name: defaultContextName(selectedLabels.size),
      context_type: entity_type,
      expr: {
        in: [{ var: "entity_label" }, entity_labels],
      },
    };

    const isCompatibleTwoContextComparison =
      plot.dimensions.x!.axis_type === "context" &&
      plot.dimensions.y?.axis_type === "context" &&
      plot.dimensions.x!.entity_type === index_type &&
      plot.dimensions.y?.entity_type === index_type &&
      plot.dimensions.x!.dataset_id !== plot.dimensions.y.dataset_id;

    return {
      plot_type: "correlation_heatmap",
      index_type,
      dimensions: {
        x: {
          axis_type: "context",
          // HACK: just use the entity_type and dataset_id from the the X axis. In theory,
          // they could be different. Should we force them to be the same?
          entity_type,
          dataset_id,
          context,
          aggregation: "correlation",
        },
      },
      ...(isCompatibleTwoContextComparison && {
        filters: {
          distinguish1: plot.dimensions.x!.context,
          distinguish2: plot.dimensions.y!.context,
        },
      }),
    };
  }

  // any -> { density_1d, scatter }
  const filters: DataExplorerFilters = {};
  let color_by: DataExplorerPlotConfig["color_by"];

  if (
    plot.dimensions.x?.entity_type === index_type &&
    !isContextAll(plot.dimensions.x.context)
  ) {
    filters.color1 = plot.dimensions.x.context;
    color_by = "entity";
  }

  if (
    plot.dimensions.y?.entity_type === index_type &&
    !isContextAll(plot.dimensions.y.context) &&
    !contextsMatch(plot.dimensions.x!.context, plot.dimensions.y.context)
  ) {
    filters.color2 = plot.dimensions.y.context;
    color_by = "entity";
  }

  if (filters.color1 && plot.dimensions.x?.axis_type === "context") {
    color_by = "context";
  }

  if (filters.color2 && plot.dimensions.y?.axis_type === "context") {
    color_by = "context";
  }

  return {
    plot_type: numDimensions === 1 ? "density_1d" : "scatter",
    index_type,
    ...(color_by ? { color_by, filters } : {}),
    dimensions: ["x", "y"].slice(0, numDimensions).reduce(
      (dimensions, dimensionKey, index) => ({
        ...dimensions,
        [dimensionKey]: {
          axis_type: "entity",
          entity_type,
          dataset_id,
          context: {
            name: entity_labels[index],
            context_type: entity_type,
            expr: { "==": [{ var: "entity_label" }, entity_labels[index]] },
          },
          aggregation: "first",
        },
      }),
      {}
    ),
  };
}

export function heatmapToDensityPlot(plot: DataExplorerPlotConfig) {
  return {
    ...plot,
    plot_type: "density_1d",
    dimensions: {
      x: {
        ...plot.dimensions.x,
        aggregation: "mean",
      },
    },
  } as DataExplorerPlotConfig;
}

export function copyXAxisToY(plot: DataExplorerPlotConfig) {
  if (!plot?.dimensions?.x) {
    return plot;
  }

  const { dimensions } = plot;
  const x = omit(dimensions.x, "sort_by");

  return {
    ...plot,
    plot_type: "scatter",
    dimensions: {
      ...dimensions,
      x,
      y: x,
    },
  } as DataExplorerPlotConfig;
}

export function swapAxisConfigs(plot: DataExplorerPlotConfig) {
  if (!plot?.dimensions) {
    return plot;
  }

  const { dimensions } = plot;
  const { x, y } = dimensions;

  if (!x || !y) {
    return plot;
  }

  return {
    ...plot,
    dimensions: {
      ...dimensions,
      x: y,
      y: x,
    },
  } as DataExplorerPlotConfig;
}

function compress(obj: object): string {
  // thanks to https://gist.github.com/heinrich-ulbricht/683ea2ac8ac0e7bc607e4f4a57534937
  const json = JSON.stringify(obj);
  const bytes = pako.deflate(json);
  return Base64.fromUint8Array(bytes, true);
}

function decompress(str: string): object {
  const bytes = Base64.toUint8Array(str);
  const json = pako.inflate(bytes, { to: "string" });
  return JSON.parse(json);
}

function normalizePlot(plot: DataExplorerPlotConfig) {
  // Remove any incomplete options first.
  const {
    color_by,
    sort_by,
    hide_points,
    use_clustering,
    show_regression_line,
    filters,
    metadata,
    ...rest
  } = plot;
  const normalized: DataExplorerPlotConfig = rest;

  if (plot.plot_type === "density_1d" && hide_points) {
    normalized.hide_points = true;
  }

  if (plot.plot_type === "scatter" && show_regression_line) {
    normalized.show_regression_line = true;
  }

  if (plot.plot_type === "correlation_heatmap") {
    if (filters?.distinguish1 || filters?.distinguish2) {
      normalized.filters = filters;
    }

    if (use_clustering) {
      normalized.use_clustering = true;
    }
  } else {
    if ((color_by && filters?.color1) || filters?.color2) {
      normalized.color_by = color_by;
      normalized.filters = filters;
    }

    if (filters?.visible) {
      normalized.filters = {
        ...normalized.filters,
        visible: filters.visible,
      };
    }

    if (
      color_by &&
      metadata &&
      !Object.values(metadata).some((m) => isPartialSliceId(m.slice_id))
    ) {
      normalized.color_by = color_by;
      normalized.metadata = metadata;

      if (sort_by) {
        normalized.sort_by = sort_by;
      }
    }

    if (color_by && rest.dimensions?.color) {
      if (isCompleteDimension(rest.dimensions.color)) {
        normalized.color_by = color_by;
      } else {
        normalized.dimensions = omit(rest.dimensions, "color");
      }
    }
  }

  return normalized;
}

export const DEFAULT_EMPTY_PLOT: PartialDataExplorerPlotConfig = {
  plot_type: "density_1d",
  index_type: "depmap_model",
  dimensions: { x: {} },
};

// To keep URLs reasonably short, contexts are now (often) encoded as hashes.
// This fetches the proper context objects and replaces the hashes with them.
async function replaceHashesWithContexts(plot: DataExplorerPlotConfig | null) {
  if (!plot) {
    return null;
  }

  const nextDimensions: any = {};
  let nextFilters: any = null;

  await Promise.all(
    (Object.keys(plot.dimensions) as DimensionKey[]).map(
      async (dimensionKey) => {
        const dimension = plot.dimensions[dimensionKey] as
          | DataExplorerPlotConfigDimension
          | {
              context: {
                hash: string;
                negated: boolean;
              };
            };

        if ("hash" in dimension.context) {
          const context = await fetchContext(dimension.context.hash);

          nextDimensions[dimensionKey] = {
            ...dimension,
            context: dimension.context.negated
              ? negateContext(context)
              : context,
          };
        } else {
          nextDimensions[dimensionKey] = dimension;
        }
      }
    )
  );

  if (plot.filters) {
    nextFilters = {};

    await Promise.all(
      (Object.keys(plot.filters) as FilterKey[]).map(async (filterKey) => {
        const filter = plot.filters![filterKey] as
          | DataExplorerContext
          | {
              hash: string;
              negated: boolean;
            };

        if ("hash" in filter) {
          const context = await fetchContext(filter.hash);

          nextFilters[filterKey] = filter.negated
            ? negateContext(context)
            : context;
        } else {
          nextFilters[filterKey] = filter;
        }
      })
    );
  }

  return {
    ...plot,
    dimensions: nextDimensions,
    ...(nextFilters ? { filters: nextFilters } : {}),
  };
}

const isTrivialContext = (context: DataExplorerContext) => {
  // FIXME: Figure out why this is happening.
  if (!context || !context.expr) {
    return true;
  }

  if (isContextAll(context)) {
    return true;
  }

  const { expr }: any = context;
  return Boolean(expr["=="]) && expr["=="].length === 2;
};

const toContextDescriptor = async (context: DataExplorerContext) => {
  const negated = isNegatedContext(context);
  const contextToHash = negated ? negateContext(context) : context;

  if (isTrivialContext(contextToHash)) {
    return context;
  }

  return {
    hash: await persistContext(contextToHash),
    negated,
  };
};

async function replaceContextsWithHashes(plot: DataExplorerPlotConfig) {
  const nextDimensions: any = {};
  let nextFilters: any = null;

  await Promise.all(
    Object.keys(plot.dimensions).map(async (dimensionKey) => {
      const dimension = plot.dimensions[dimensionKey as DimensionKey];

      nextDimensions[dimensionKey] = {
        ...dimension,
        context: await toContextDescriptor(dimension!.context),
      };
    })
  );

  if (plot.filters) {
    nextFilters = {};

    await Promise.all(
      Object.keys(plot.filters).map(async (filterKey) => {
        const filter = plot.filters![filterKey as FilterKey];
        nextFilters[filterKey] = await toContextDescriptor(filter!);
      })
    );
  }

  return {
    ...plot,
    dimensions: nextDimensions,
    ...(nextFilters ? { filters: nextFilters } : {}),
  };
}

export async function plotToQueryString(
  plot: DataExplorerPlotConfig,
  paramsToDrop?: string[]
) {
  const params = qs.parse(window.location.search.substr(1));
  let nextParams = omitShorthandParams(params);

  if (paramsToDrop) {
    nextParams = omit(nextParams, paramsToDrop);
  }

  const encodedPlot = await replaceContextsWithHashes(normalizePlot(plot));
  const serialized = compress(encodedPlot);

  return `?${qs.stringify({ ...nextParams, p: serialized })}`;
}

export async function readPlotFromQueryString(): Promise<DataExplorerPlotConfig> {
  const params = qs.parse(window.location.search.substr(1));
  let plot: DataExplorerPlotConfig | null = null;

  // First we try to parse simplified params like xDataset, xFeature, yContext,
  // etc. This is the human-readable format that is intended to mimic Data
  // Explorer 1. We assume this style of URL will not include any of the params
  // below (which are typical of auto-generated URLs) but those params can
  // override any values parsed here.
  if (hasSomeShorthandParams(params)) {
    const datasets = await fetchDatasetsByIndexType();
    plot = parseShorthandParams(params, datasets);
  }

  // Old format
  if (params.plot) {
    const decoded = Base64.decode(params.plot as string);
    plot = JSON.parse(decoded);
  }

  // New compressed format
  if (params.p) {
    plot = decompress(params.p as string) as DataExplorerPlotConfig;
  }

  // `plot.dimensions` used to be an array but now it's an object.
  // Just in case there are any old bookmarks hanging around,
  // we'll parse the array and transform it into an object.
  if (plot && Array.isArray(plot.dimensions)) {
    const [x, y] = plot.dimensions;

    plot.dimensions = {
      ...(x && { x }),
      ...(y && { y }),
      // no `color` dimension because this format predates that
    };
  }

  plot = await replaceHashesWithContexts(plot);

  return (plot as DataExplorerPlotConfig) || DEFAULT_EMPTY_PLOT;
}

export function plotsAreEquivalentWhenSerialized(
  plotA: DataExplorerPlotConfig,
  plotB: DataExplorerPlotConfig
) {
  return (
    stableStringify(normalizePlot(plotA)) ===
    stableStringify(normalizePlot(plotB))
  );
}

const stripExprFromContext = (context: DataExplorerContext) => {
  const { expr, ...rest } = context;
  return rest;
};

export function someLegacyContextsExist() {
  const LEGACY_KEY = "dx2_prototype_user_contexts";

  return Boolean(window.localStorage.getItem(LEGACY_KEY));
}

export async function convertLegacyContexts() {
  const contexts: StoredContexts = {};
  const LEGACY_KEY = "dx2_prototype_user_contexts";
  const legacyFormat = window.localStorage.getItem(LEGACY_KEY);

  if (!legacyFormat) {
    return {};
  }

  // Ignore the old hashes; they're no longer useful.
  const legacyContexts = Object.values(decompress(legacyFormat));

  const persisted = await Promise.all(
    legacyContexts.map((context: DataExplorerContext) => {
      return persistContext(context).then((hash) => ({ ...context, hash }));
    })
  );

  persisted.forEach(
    (contextWithHash: DataExplorerContext & { hash: string }) => {
      const { hash, name, context_type } = contextWithHash;
      contexts[hash] = { name, context_type };
    }
  );

  const MODERN_KEY = "user_contexts";
  localStorage.setItem(MODERN_KEY, JSON.stringify(contexts));
  window.localStorage.removeItem(LEGACY_KEY);

  return contexts;
}

// TODO: Rename this to communicate that it also persists it to a bucket.
export async function saveContextToLocalStorage(
  context: DataExplorerContext,
  hashToReplace?: string | null
) {
  let nextHash;
  const json = window.localStorage.getItem("user_contexts");
  const existingContexts: StoredContexts = json ? JSON.parse(json) : {};

  const updates = await Promise.all(
    Object.entries(existingContexts).map(async ([oldHash, oldValue]) => {
      if (oldHash === hashToReplace) {
        nextHash = await persistContext(context);

        return {
          hash: nextHash,
          value: stripExprFromContext(context),
        };
      }

      return { hash: oldHash, value: oldValue };
    })
  );

  if (!hashToReplace) {
    nextHash = await persistContext(context);

    updates.push({
      hash: nextHash,
      value: stripExprFromContext(context),
    });
  }

  const updatedContexts: StoredContexts = {};

  updates.forEach(({ hash, value }) => {
    updatedContexts[hash] = value;
  });

  window.localStorage.setItem("user_contexts", JSON.stringify(updatedContexts));

  // WORKAROUND: These hosts are special in that they simulates multiple
  // environments (public, Skyros, DMC, PedDep). Each env has its own external
  // storage but shares local storage. That means they can "see" each other's
  // contexts but can't actually fetch them. This mechanism corrects for that.
  if (["dev.cds.team", "127.0.0.1"].includes(window.location.hostname)) {
    const { rootUrl } = JSON.parse(
      document.getElementById("webpack-config")!.textContent as string
    );

    const devContextsByRootUrl = JSON.parse(
      window.localStorage.getItem("dev_contexts_by_root_url") || "{}"
    );

    const devContexts = devContextsByRootUrl[rootUrl] || [];
    devContextsByRootUrl[rootUrl] = [...new Set(devContexts.concat(nextHash))];

    window.localStorage.setItem(
      "dev_contexts_by_root_url",
      JSON.stringify(devContextsByRootUrl)
    );
  }

  return nextHash as string;
}

// This only deletes the entry from the map of hashes to names. The content of
// the context still persists in the CAS.
export function deleteContextFromLocalStorage(hashToDelete: string) {
  const json = window.localStorage.getItem("user_contexts");
  const existingContexts: StoredContexts = json ? JSON.parse(json) : {};

  const updatedContexts: StoredContexts = {};

  Object.entries(existingContexts).forEach(([oldHash, oldContext]) => {
    if (oldHash !== hashToDelete) {
      updatedContexts[oldHash] = oldContext;
    }
  });

  window.localStorage.setItem("user_contexts", JSON.stringify(updatedContexts));
}

export function findPathsToContext(
  plot: DataExplorerPlotConfig,
  context: DataExplorerContext
) {
  const paths: ContextPath[] = [];

  Object.entries(plot.dimensions).forEach(([key, dimension]) => {
    if (contextsMatch(context, dimension.context)) {
      paths.push(["dimensions", key as DimensionKey, "context"]);
    }
  });

  Object.entries(plot.filters || {}).forEach(([key, filter]) => {
    if (contextsMatch(context, filter)) {
      paths.push(["filters", key as FilterKey]);
    }
  });

  return paths;
}
