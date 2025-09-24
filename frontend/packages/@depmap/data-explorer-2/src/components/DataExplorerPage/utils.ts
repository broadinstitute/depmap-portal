import qs from "qs";
import pako from "pako";
import omit from "lodash.omit";
import { Base64 } from "js-base64";
import stableStringify from "json-stable-stringify";
import {
  ContextPath,
  DataExplorerContext,
  DataExplorerContextV2,
  DataExplorerFilters,
  DataExplorerPlotConfig,
  DataExplorerPlotConfigDimension,
  DataExplorerPlotConfigDimensionV2,
  DimensionKey,
  FilterKey,
  isValidSliceQuery,
  PartialDataExplorerPlotConfig,
} from "@depmap/types";
import { isBreadboxOnlyMode } from "../../isBreadboxOnlyMode";
import { dataExplorerAPI } from "../../services/dataExplorerAPI";
import {
  contextsMatch,
  isContextAll,
  isNegatedContext,
  isV2Context,
  negateContext,
} from "../../utils/context";
import { fetchContext, persistContext } from "../../utils/context-storage";
import { isCompleteDimension, isPartialSliceId } from "../../utils/misc";
import { convertContextV1toV2 } from "../../utils/context-converter";
import { sliceIdToSliceQuery } from "../../utils/slice-id";
import {
  hasSomeShorthandParams,
  omitShorthandParams,
  parseShorthandParams,
} from "./query-string-parser";

export const defaultContextName = (numLabels: number) => {
  return ["(", numLabels, " selected", ")"].join("");
};

export function toRelatedPlot(
  plot: DataExplorerPlotConfig,
  selectedLabels: Set<string>,
  identifiers: { id: string; label: string }[]
): DataExplorerPlotConfig {
  const numDimensions = Math.min(selectedLabels.size, 2);
  const slice_labels = [...selectedLabels];

  const idToLabelMap = Object.fromEntries(
    identifiers.map(({ id, label }) => [id, label])
  );

  const labelToIdMap = Object.fromEntries(
    identifiers.map(({ label, id }) => [label, id])
  );

  const toSliceName = (label: string, slice_type: string) => {
    if (isBreadboxOnlyMode && slice_type === "depmap_model") {
      return idToLabelMap[label];
    }

    return label;
  };

  const toVarEqualityExpression = (label: string, slice_type: string) => {
    if (isBreadboxOnlyMode) {
      let given_id = labelToIdMap[label];

      if (
        (plot.plot_type === "correlation_heatmap" &&
          slice_type === "depmap_model") ||
        (plot.plot_type !== "correlation_heatmap" &&
          plot.index_type === "depmap_model")
      ) {
        given_id = label;
      }

      return { "==": [{ var: "given_id" }, given_id] };
    }

    return { "==": [{ var: "entity_label" }, label] };
  };

  const toVarInclusionExpression = (labels: string[]) => {
    if (isBreadboxOnlyMode) {
      const ids =
        plot.index_type === "depmap_model"
          ? labels
          : labels.map((label) => labelToIdMap[label]);

      return { in: [{ var: "given_id" }, ids] };
    }

    return { in: [{ var: "entity_label" }, labels] };
  };

  const toSingleSliceContext = (slice_type: string, label: string) => {
    if (isBreadboxOnlyMode) {
      return {
        name: toSliceName(label, slice_type),
        dimension_type: slice_type,
        expr: toVarEqualityExpression(label, slice_type),
        vars: {},
      };
    }

    return {
      name: toSliceName(label, slice_type),
      context_type: slice_type,
      expr: toVarEqualityExpression(label, slice_type),
    };
  };

  const toMultiSliceContext = (slice_type: string, labels: string[]) => {
    if (isBreadboxOnlyMode) {
      return {
        name: defaultContextName(selectedLabels.size),
        dimension_type: slice_type,
        expr: toVarInclusionExpression(labels),
        vars: {},
      } as DataExplorerContextV2;
    }

    return {
      name: defaultContextName(selectedLabels.size),
      context_type: slice_type,
      expr: toVarInclusionExpression(labels),
    } as DataExplorerContext;
  };

  // correlation_heatmap -> any
  // Linking from a correlation heatmap is weird. We don't want to flip the
  // index_type and the index_labels actually match the slice_type.
  if (plot.plot_type === "correlation_heatmap") {
    const { index_type } = plot;
    const { dataset_id, slice_type } = plot.dimensions
      .x as DataExplorerPlotConfigDimension;

    const filters: DataExplorerFilters = {};
    let color_by: DataExplorerPlotConfig["color_by"];

    if (
      plot.filters?.distinguish1 &&
      !isContextAll(plot.filters?.distinguish1)
    ) {
      color_by = "aggregated_slice";
      filters.color1 = plot.filters?.distinguish1;
    }

    if (
      plot.filters?.distinguish2 &&
      !isContextAll(plot.filters?.distinguish2)
    ) {
      color_by = "aggregated_slice";
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
            slice_type,
            dataset_id,
            axis_type: "raw_slice",
            aggregation: "first",
            context: toSingleSliceContext(slice_type, slice_labels[index]),
          },
        }),
        {}
      ),
      ...(Object.keys(filters).length > 0 && { filters }),
    };
  }

  const index_type = plot.dimensions.x!.slice_type;
  const { dataset_id } = plot.dimensions.x as DataExplorerPlotConfigDimension;
  const slice_type = plot.index_type;

  // { density_1d, waterfall, scatter } -> correlation_heatmap
  if (selectedLabels.size > 2) {
    const context = toMultiSliceContext(slice_type, slice_labels);

    const isCompatibleTwoContextComparison =
      plot.dimensions.x!.axis_type === "aggregated_slice" &&
      plot.dimensions.y?.axis_type === "aggregated_slice" &&
      plot.dimensions.x!.slice_type === index_type &&
      plot.dimensions.y?.slice_type === index_type &&
      plot.dimensions.x!.dataset_id !== plot.dimensions.y.dataset_id;

    return {
      plot_type: "correlation_heatmap",
      index_type,
      dimensions: {
        x: {
          axis_type: "aggregated_slice",
          // HACK: just use the slice_type and dataset_id from the the X axis. In theory,
          // they could be different. Should we force them to be the same?
          slice_type,
          dataset_id,
          context: context as DataExplorerContext,
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
    plot.dimensions.x?.slice_type === index_type &&
    !isContextAll(plot.dimensions.x.context)
  ) {
    filters.color1 = plot.dimensions.x.context;
    color_by = "raw_slice";
  }

  if (
    plot.dimensions.y?.slice_type === index_type &&
    !isContextAll(plot.dimensions.y.context) &&
    !contextsMatch(plot.dimensions.x!.context, plot.dimensions.y.context)
  ) {
    filters.color2 = plot.dimensions.y.context;
    color_by = "raw_slice";
  }

  if (filters.color1 && plot.dimensions.x?.axis_type === "aggregated_slice") {
    color_by = "aggregated_slice";
  }

  if (filters.color2 && plot.dimensions.y?.axis_type === "aggregated_slice") {
    color_by = "aggregated_slice";
  }

  return {
    plot_type: numDimensions === 1 ? "density_1d" : "scatter",
    index_type,
    ...(color_by ? { color_by, filters } : {}),
    dimensions: ["x", "y"].slice(0, numDimensions).reduce(
      (dimensions, dimensionKey, index) => ({
        ...dimensions,
        [dimensionKey]: {
          axis_type: "raw_slice",
          aggregation: "first",
          slice_type,
          dataset_id,
          context: toSingleSliceContext(slice_type, slice_labels[index]),
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
      !Object.values(metadata).some((m) => {
        return "slice_id" in m
          ? isPartialSliceId(m.slice_id)
          : !isValidSliceQuery(m);
      })
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

        let context =
          "hash" in dimension.context
            ? await fetchContext(dimension.context.hash)
            : dimension.context;

        if (isBreadboxOnlyMode && !isV2Context(context)) {
          const { convertedContext } = await convertContextV1toV2(context);
          context = convertedContext;
        }

        nextDimensions[dimensionKey] = {
          ...dimension,
          context:
            "negated" in dimension.context && dimension.context.negated
              ? negateContext(context as DataExplorerContext)
              : context,
        };
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

        let context =
          "hash" in filter ? await fetchContext(filter.hash) : filter;

        if (isBreadboxOnlyMode && !isV2Context(context)) {
          const { convertedContext } = await convertContextV1toV2(context);
          context = convertedContext;
        }

        nextFilters[filterKey] =
          "negated" in filter && filter.negated
            ? negateContext(context as DataExplorerContext)
            : context;
      })
    );
  }

  return {
    ...plot,
    dimensions: nextDimensions,
    ...(nextFilters ? { filters: nextFilters } : {}),
  };
}

const isTrivialContext = (
  context: DataExplorerContext | DataExplorerContextV2
) => {
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

const toContextDescriptor = async (
  context: DataExplorerContext | DataExplorerContextV2
) => {
  const negated = isNegatedContext(context);
  const contextToHash = negated
    ? negateContext(context as DataExplorerContext)
    : context;

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

const replaceLegacyPropertyNames = (plot: DataExplorerPlotConfig | null) => {
  if (!plot) {
    return null;
  }

  const legacyPlot = (plot as unknown) as {
    // The values for `color_by` are now
    // "raw_slice" | "aggregated_slice" | "property" | "custom"
    color_by?: "entity" | "context" | "property" | "custom";
  };

  if (legacyPlot.color_by === "entity") {
    // eslint-disable-next-line no-param-reassign
    plot.color_by = "raw_slice";
  }

  if (legacyPlot.color_by === "context") {
    // eslint-disable-next-line no-param-reassign
    plot.color_by = "aggregated_slice";
  }

  (Object.keys(plot.dimensions) as DimensionKey[]).forEach((dKey) => {
    const dim = plot.dimensions[dKey] as DataExplorerPlotConfigDimension;

    const legacyDim = (dim as unknown) as {
      // "entity_type" has been renamed to "slice_type"
      entity_type?: string;
      // The values for `axis_type` are now "raw_slice" | "aggregated_slice"
      axis_type?: "entity" | "context";
    };

    if (legacyDim.entity_type) {
      dim.slice_type = legacyDim.entity_type;
      delete legacyDim.entity_type;
    }

    if (legacyDim.axis_type === "entity") {
      dim.axis_type = "raw_slice";
    }

    if (legacyDim.axis_type === "context") {
      dim.axis_type = "aggregated_slice";
    }
  });

  return plot;
};

export async function readPlotFromQueryString(): Promise<DataExplorerPlotConfig> {
  const params = qs.parse(window.location.search.substr(1));
  let plot: DataExplorerPlotConfig | null = null;

  // First we try to parse simplified params like xDataset, xFeature, yContext,
  // etc. This is the human-readable format that is intended to mimic Data
  // Explorer 1. We assume this style of URL will not include any of the params
  // below (which are typical of auto-generated URLs) but those params can
  // override any values parsed here.
  if (hasSomeShorthandParams(params)) {
    const datasets = await dataExplorerAPI.fetchDatasetsByIndexType();
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

  plot = replaceLegacyPropertyNames(plot);
  plot = await replaceHashesWithContexts(plot);

  if (isBreadboxOnlyMode && plot?.dimensions) {
    for (const dimKey of Object.keys(plot.dimensions)) {
      const d = plot.dimensions[dimKey as DimensionKey]!;
      // Strip any "/breadbox" prefixes from dataset IDs.
      d.dataset_id = d.dataset_id.replace("breadbox/", "");

      // "custom" was never a real dimension type -- just a sentinel
      // value we had been using. We use `null` for that now.
      if (d.slice_type === "custom") {
        ((d as unknown) as DataExplorerPlotConfigDimensionV2).slice_type = null;
      }
    }
  }

  // Convert any `metadata` values from slice IDs to SliceQuery objects.
  if (isBreadboxOnlyMode && plot?.metadata) {
    for (const key of Object.keys(plot.metadata)) {
      const value = plot.metadata[key];

      if ("slice_id" in value) {
        const nextValue = sliceIdToSliceQuery(
          value.slice_id,
          "categorical",
          plot.index_type
        );

        plot.metadata[key] = nextValue;

        if (key === "color_property" && nextValue) {
          plot.color_by = nextValue.dataset_id.endsWith("_metadata")
            ? "metadata_column"
            : "tabular_dataset";
        }
      }
    }
  }

  return (plot || DEFAULT_EMPTY_PLOT) as DataExplorerPlotConfig;
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
