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
  DimensionKey,
  FilterKey,
  isValidSliceQuery,
  PartialDataExplorerPlotConfig,
} from "@depmap/types";
import { dataExplorerAPI } from "../../services/dataExplorerAPI";
import {
  contextsMatch,
  isNegatedContext,
  isV2Context,
  negateContext,
  replaceLegacyContextIfExistsInLocalStorage,
} from "../../utils/context";
import { isContextAll } from "../../utils/contextExpr";
import { fetchContext, persistContext } from "../../utils/context-storage";
import {
  makePlotConfigBreadboxModeCompatible as makePlotConfigBreadboxModeCompatibleImpl,
  normalizePlotConfig,
} from "../../utils/normalizePlotConfig";
import { isPartialSliceId } from "../../utils/misc";
import { isCompleteDimension } from "../../utils/dimensionHelpers";
import { convertContextV1toV2 } from "../../utils/context-converter";
import {
  hasSomeShorthandParams,
  omitShorthandParams,
  parseShorthandParams,
} from "./query-string-parser";
import { CURRENT_PLOT_VERSION } from "./plot-version";
import plotConfigReducer from "./reducers/plotConfigReducer";
import { canShowRegressionLinePerColor } from "./colorFacetSwap";

// Re-exported so existing callers (and tests) can keep importing this from
// `./utils`. The definition lives in its own module to keep the import graph
// acyclic — see the comment there.
export { CURRENT_PLOT_VERSION };

export const defaultContextName = (numLabels: number) => {
  return ["(", numLabels, " selected", ")"].join("");
};

export function toRelatedPlot(
  plot: DataExplorerPlotConfig,
  selectedIds: Set<string>,
  identifiers: { id: string; label: string }[]
): DataExplorerPlotConfig {
  const numDimensions = Math.min(selectedIds.size, 2);
  const slice_ids = [...selectedIds];

  const idToLabelMap = Object.fromEntries(
    identifiers.map(({ id, label }) => [id, label])
  );

  // The input set is real Breadbox IDs, regardless of `index_type` or
  // `slice_type`. The context expressions emitted below reference those
  // IDs directly through `given_id` — no per-type translation.

  const toSliceName = (id: string) => idToLabelMap[id];

  const toVarEqualityExpression = (id: string) => {
    return { "==": [{ var: "given_id" }, id] };
  };

  const toVarInclusionExpression = (ids: string[]) => {
    return { in: [{ var: "given_id" }, ids] };
  };

  const toSingleSliceContext = (slice_type: string, id: string) => {
    return {
      name: toSliceName(id),
      dimension_type: slice_type,
      expr: toVarEqualityExpression(id),
      vars: {},
    };
  };

  const toMultiSliceContext = (slice_type: string, ids: string[]) => {
    return {
      name: defaultContextName(selectedIds.size),
      dimension_type: slice_type,
      expr: toVarInclusionExpression(ids),
      vars: {},
    };
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
            context: toSingleSliceContext(slice_type, slice_ids[index]),
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
  if (selectedIds.size > 2) {
    const context = toMultiSliceContext(slice_type, slice_ids);

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

  const plot_type =
    numDimensions === 1 ? ("density_1d" as const) : ("scatter" as const);

  const nextDimensions = ["x", "y"].slice(0, numDimensions).reduce(
    (dimensions, dimensionKey, index) => ({
      ...dimensions,
      [dimensionKey]: {
        axis_type: "raw_slice",
        aggregation: "first",
        slice_type,
        dataset_id,
        context: toSingleSliceContext(slice_type, slice_ids[index]),
      },
    }),
    {}
  );

  let nextPlot = {
    plot_type,
    index_type,
    dimensions: nextDimensions,
  } as DataExplorerPlotConfig;

  if (color_by) {
    nextPlot = { ...nextPlot, color_by, filters };

    if (color_by === "aggregated_slice") {
      nextPlot = plotConfigReducer(nextPlot, {
        type: "swap_color_and_facet",
      }) as DataExplorerPlotConfig;
    }
  }

  return nextPlot;
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

// Re-exported so existing callers can keep importing these from `./utils`. The
// definitions live in their own module to keep the import graph acyclic.
export {
  canShowRegressionLinePerColor,
  canSwapColorAndFacet,
  getColorFacetSwapMode,
  isAxisComplete,
} from "./colorFacetSwap";
export type { ColorFacetSwapMode, SwappablePlot } from "./colorFacetSwap";

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

export function normalizePlot(plot: DataExplorerPlotConfig) {
  // Remove any incomplete options first.
  const {
    color_by,
    facet_by,
    sort_by,
    hide_points,
    use_clustering,
    show_regression_line,
    show_regression_line_per_color,
    filters,
    metadata,
    // `version` is deliberately NOT listed here — it must survive into `rest`
    // so the serialization in plotToQueryString round-trips it correctly. If you
    // add it to this destructure for any reason, you must re-add it
    // unconditionally in every branch below, or stamped payloads lose their
    // version and the reader treats them as pre-versioning legacy.
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
    // `sort_by` controls the ordering of facets. Every one of its values is a
    // function of the data alone; none is semantically dependent on the color
    // dimension. Its entanglement with `color_by` was historical: preservation
    // used to happen only inside the color arms below, so `sort_by` survived
    // normalization only when some color backing happened to be complete, and
    // was silently dropped otherwise. That is why `sort_by: "alphabetical"` set
    // by Transcript Explorer vanished on refresh — the plot round-tripped
    // through `plotToQueryString` and matched no color arm.
    //
    // Preserve it unconditionally here and let the color arms below concern
    // themselves only with color. This is the same allowlist hazard that bit
    // `color_by: "expansion"`: anything destructured out at the top of this
    // function must be deliberately shepherded back in, and a field re-added
    // only inside conditional branches is a field that is conditionally lost.
    //
    // (Deliberately inside the non-heatmap arm: `correlation_heatmap` has no
    // facets to order — it is ordered by `use_clustering` — so it has never
    // carried a meaningful `sort_by`.)
    if (sort_by) {
      normalized.sort_by = sort_by;
    }

    // `color_by: "expansion"` colors points by their expansion member and is
    // backed by `expand_by` (which rides through untouched in `rest`), not by a
    // color dimension/filter/metadata. The branches below only re-add `color_by`
    // when one of those backings is complete, so without this an expanded plot
    // would silently lose its coloring on normalize. Preserve it whenever the
    // plot is actually expanded.
    if (color_by === "expansion" && Boolean(rest.expand_by?.length)) {
      normalized.color_by = color_by;
    }

    // `color_by: "facet"` (version 2, ADR 0001/0004) is a pure alias to
    // facet_by's own resolution — it has no backing of its own, unlike
    // every other color_by value. Deliberately NOT re-added here: this is
    // sound, not an oversight, ONLY because absent color_by in a version-2
    // payload already reads back as "facet" (see readPlotFromQueryString's
    // v1->v2 migration), so stripping it is a no-op on meaning and saves
    // bytes on every URL where the user took the (now-default) option. If a
    // future version ever changes what absence means again, this comment
    // is the one to revisit before "fixing" this into a preserving arm.
    //
    // `color_by: "uniform"` (version 2) is the opposite case: it is NOT
    // equivalent to absence post-v2 (absence means "facet") — that is the
    // entire reason the sentinel exists. It has nothing to validate (no
    // backing, complete by construction), so it is preserved
    // unconditionally, or an explicit "no color" choice would silently
    // revert to "facet" on the next round-trip.
    if (color_by === "uniform") {
      normalized.color_by = color_by;
    }

    // The three arms below re-add color_by only when ITS OWN backing
    // (filters.color1/2, metadata.color_property, dimensions.color) is
    // complete. "facet"/"uniform" are truthy strings with no such backing;
    // excluding them here is a stale-data backstop — if leftover
    // filters.color1/dimensions.color/metadata.color_property ever survive
    // on a plot whose color_by is "facet"/"uniform" (which shouldn't
    // normally happen given disciplined reducers, but normalizePlot exists
    // precisely to be the backstop against "shouldn't normally happen"),
    // these arms must not re-stamp color_by alongside backing data a reader
    // would wrongly associate with it.
    const color_by_has_own_backing =
      color_by && color_by !== "facet" && color_by !== "uniform";

    // `color_by: "raw_slice" | "aggregated_slice"` is backed by
    // filters.color1/color2. Scoped to those two keys specifically (not the
    // whole `filters` object) so an unrelated filter (facet1/facet2,
    // distinguish1/distinguish2) can never make an incomplete color_by
    // survive, and merged in (not assigned outright) since another arm may
    // have already started building normalized.filters from the same
    // shared object.
    if (color_by_has_own_backing && (filters?.color1 || filters?.color2)) {
      normalized.color_by = color_by;
      normalized.filters = {
        ...normalized.filters,
        ...(filters.color1 && { color1: filters.color1 }),
        ...(filters.color2 && { color2: filters.color2 }),
      };
    }

    if (filters?.visible) {
      normalized.filters = {
        ...normalized.filters,
        visible: filters.visible,
      };
    }

    // `color_by: "property"` is backed by metadata.color_property
    // specifically. Checked independently of the whole `metadata` bag (ADR
    // 0002 §3): validating "no entry in metadata is invalid" is vacuously
    // true for an empty metadata object, or one holding only an unrelated
    // key (e.g. facet_property) — either would let an unbacked color_by
    // survive. Checking the specific key's presence closes that hole.
    const color_property = metadata?.color_property;
    if (
      color_by_has_own_backing &&
      color_property &&
      ("slice_id" in color_property
        ? !isPartialSliceId(color_property.slice_id)
        : isValidSliceQuery(color_property))
    ) {
      normalized.color_by = color_by;
      normalized.metadata = {
        ...normalized.metadata,
        color_property,
      };
    }

    if (color_by_has_own_backing && rest.dimensions?.color) {
      if (isCompleteDimension(rest.dimensions.color)) {
        normalized.color_by = color_by;
      } else {
        normalized.dimensions = omit(rest.dimensions, "color");
      }
    }

    // `facet_by: "expansion"` facets points by their expansion member and is
    // backed by `expand_by` (rides through untouched in `rest`), exactly like
    // `color_by: "expansion"` above. Without this, an expanded plot would
    // silently lose its faceting on normalize.
    if (facet_by === "expansion" && Boolean(rest.expand_by?.length)) {
      normalized.facet_by = facet_by;
    }

    // `facet_by: "property"` is backed by `metadata.facet_property`, not by
    // anything color_by touches. Checked independently of color_by's own
    // metadata gate above (ADR 0002 §3: a field's survival must not be
    // coupled to an unrelated field's state) — facet_by must survive whether
    // or not color_by/its metadata happens to be complete, and must not drag
    // an incomplete color_property along with it.
    const facet_property = metadata?.facet_property;
    if (
      facet_by &&
      facet_property &&
      ("slice_id" in facet_property
        ? !isPartialSliceId(facet_property.slice_id)
        : isValidSliceQuery(facet_property))
    ) {
      normalized.facet_by = facet_by;
      normalized.metadata = {
        ...normalized.metadata,
        facet_property,
      };
    }

    // `facet_by: "raw_slice" | "aggregated_slice"` is backed by
    // filters.facet1/facet2, the parallel of filters.color1/color2. Merged in
    // (not assigned outright) since the color arm above may have already set
    // normalized.filters from the same shared `filters` object.
    if (facet_by && (filters?.facet1 || filters?.facet2)) {
      normalized.facet_by = facet_by;
      normalized.filters = {
        ...normalized.filters,
        ...(filters.facet1 && { facet1: filters.facet1 }),
        ...(filters.facet2 && { facet2: filters.facet2 }),
      };
    }

    // `facet_by: "custom"` is backed by dimensions.facet, the parallel of
    // dimensions.color. Omits from `normalized.dimensions` (not `rest.dimensions`)
    // so an already-stripped incomplete color dimension can't be reintroduced
    // by this arm re-deriving from the untouched original.
    if (facet_by && rest.dimensions?.facet) {
      if (isCompleteDimension(rest.dimensions.facet)) {
        normalized.facet_by = facet_by;
      } else {
        normalized.dimensions = omit(normalized.dimensions, "facet");
      }
    }
  }

  // `show_regression_line_per_color` is a sub-option of the faceted regression:
  // it only means anything while color_by and facet_by BOTH survive as real,
  // distinct partitions. Checked against `normalized` rather than `plot`
  // deliberately — this has to run after the color/facet arms above have
  // settled, so an axis whose backing was just dropped as incomplete takes the
  // option down with it instead of leaving it stranded on a plot that now draws
  // one line per panel. (ADR 0002 §3's "no incidental coupling" is satisfied:
  // the dependency on color_by/facet_by is the option's whole definition.)
  if (
    plot.plot_type === "scatter" &&
    show_regression_line_per_color &&
    canShowRegressionLinePerColor(normalized)
  ) {
    normalized.show_regression_line_per_color = true;
  }

  return normalized;
}

export const DEFAULT_EMPTY_PLOT: PartialDataExplorerPlotConfig = {
  plot_type: "density_1d",
  index_type: "depmap_model",
  dimensions: { x: {} },
};

const isTrivialContext = (context: DataExplorerContextV2) => {
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
  inputContext: DataExplorerContext | DataExplorerContextV2
) => {
  const context = !isV2Context(inputContext)
    ? await convertContextV1toV2(inputContext)
    : inputContext;

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

  const encodedPlot = await replaceContextsWithHashes(
    normalizePlot({ ...plot, version: CURRENT_PLOT_VERSION })
  );
  const serialized = compress(encodedPlot);

  return `?${qs.stringify({ ...nextParams, p: serialized })}`;
}

// Decodes the plot in the URL but changes nothing about it: no migrations, and
// `version` is left attached. Use this when something downstream (like the
// plot-data endpoint) is going to normalize it.
export async function decodePlotFromQueryString(): Promise<DataExplorerPlotConfig | null> {
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

    // `color1`/`color2` are legacy shorthand for "color by this context". We
    // now want such links to color AND facet, which is exactly the "promote"
    // case of swapping: color's backing moves to facet_by and color_by defers
    // to it. This lives here rather than in the parser because the reducer
    // imports from this module, and the parser importing it would be a cycle.
    if (plot && (params.color1 || params.color2)) {
      plot = plotConfigReducer(plot, {
        type: "swap_color_and_facet",
      }) as DataExplorerPlotConfig;
    }
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

  return plot;
}

// Everything the browser injects into normalizePlotConfig. (The Node script
// injects its own; see embed-frontend/src/node.)
const BROWSER_NORMALIZE_DEPS = {
  fetchContext,
  convertContextV1toV2,
  onLegacyContextConverted: replaceLegacyContextIfExistsInLocalStorage,
};

// Kept as a wrapper because StartScreenExample uses it directly.
export function makePlotConfigBreadboxModeCompatible(
  legacyPlot: DataExplorerPlotConfig
) {
  return makePlotConfigBreadboxModeCompatibleImpl(
    legacyPlot,
    BROWSER_NORMALIZE_DEPS
  );
}

export async function readPlotFromQueryString(): Promise<DataExplorerPlotConfig> {
  const plot = await decodePlotFromQueryString();
  const normalized = await normalizePlotConfig(plot, BROWSER_NORMALIZE_DEPS);

  return (normalized || DEFAULT_EMPTY_PLOT) as DataExplorerPlotConfig;
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
  context: DataExplorerContextV2
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
