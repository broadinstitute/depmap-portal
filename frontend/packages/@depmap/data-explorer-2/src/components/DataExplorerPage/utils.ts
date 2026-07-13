import qs from "qs";
import pako from "pako";
import omit from "lodash.omit";
import { Base64 } from "js-base64";
import stableStringify from "json-stable-stringify";
import { breadboxAPI, cached } from "@depmap/api";
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
import { dataExplorerAPI } from "../../services/dataExplorerAPI";
import {
  contextsMatch,
  isContextAll,
  isNegatedContext,
  isV2Context,
  negateContext,
  replaceLegacyContextIfExistsInLocalStorage,
} from "../../utils/context";
import { fetchContext, persistContext } from "../../utils/context-storage";
import { isCompleteDimension, isPartialSliceId } from "../../utils/misc";
import { convertContextV1toV2 } from "../../utils/context-converter";
import {
  legacyPortalIdToBreadboxGivenId,
  sliceIdToSliceQuery,
} from "../../utils/slice-id";
import wellKnownDatasets from "../../constants/wellKnownDatasets";
import {
  hasSomeShorthandParams,
  omitShorthandParams,
  parseShorthandParams,
} from "./query-string-parser";
import { CURRENT_PLOT_VERSION } from "./plot-version";

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
          context: toSingleSliceContext(slice_type, slice_ids[index]),
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

export function normalizePlot(plot: DataExplorerPlotConfig) {
  // Remove any incomplete options first.
  const {
    color_by,
    sort_by,
    hide_points,
    use_clustering,
    show_regression_line,
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
    // `sort_by` controls the ordering of groups. Every one of its values is a
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
    // groups to order — it is ordered by `use_clustering` — so it has never
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

        const maybeLegacyContext =
          "hash" in dimension.context
            ? await fetchContext(dimension.context.hash)
            : dimension.context;

        const context = !isV2Context(maybeLegacyContext)
          ? await convertContextV1toV2(maybeLegacyContext)
          : maybeLegacyContext;

        nextDimensions[dimensionKey] = {
          ...dimension,
          context:
            "negated" in dimension.context && dimension.context.negated
              ? negateContext(context)
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
          | DataExplorerContextV2
          | {
              hash: string;
              negated: boolean;
            };

        const maybeLegacyContext =
          "hash" in filter ? await fetchContext(filter.hash) : filter;

        const context = !isV2Context(maybeLegacyContext)
          ? await convertContextV1toV2(maybeLegacyContext)
          : maybeLegacyContext;

        nextFilters[filterKey] =
          "negated" in filter && filter.negated
            ? negateContext(context)
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

// Called only from makePlotConfigBreadboxModeCompatible, which itself has a
// second caller (StartScreenExample) besides readPlotFromQueryString. Do not
// gate this on payload version: the side effect
// (replaceLegacyContextIfExistsInLocalStorage) must fire for every caller, and
// version describes only the `p`-param payload, not the StartScreen path.
async function convertAllLegacyContexts(plot: DataExplorerPlotConfig | null) {
  if (!plot) {
    return null;
  }

  const nextDimensions: any = {};
  let nextFilters: any = null;

  if (plot.dimensions) {
    await Promise.all(
      (Object.keys(plot.dimensions) as DimensionKey[]).map(
        async (dimensionKey) => {
          const dimension = plot.dimensions[dimensionKey];
          let context = dimension!.context;

          if (!isV2Context(context)) {
            const convertedContext = await convertContextV1toV2(context);
            replaceLegacyContextIfExistsInLocalStorage(
              context,
              convertedContext
            );
            context = convertedContext;
          }

          nextDimensions[dimensionKey] = { ...dimension, context };
        }
      )
    );
  }

  if (plot.filters) {
    nextFilters = {};

    await Promise.all(
      (Object.keys(plot.filters) as FilterKey[]).map(async (filterKey) => {
        const filter = plot.filters![filterKey];
        let context = filter!;

        if (!isV2Context(context)) {
          const convertedContext = await convertContextV1toV2(context);
          replaceLegacyContextIfExistsInLocalStorage(context, convertedContext);
          context = convertedContext;
        }

        nextFilters[filterKey] = context;
      })
    );
  }

  return {
    ...plot,
    dimensions: nextDimensions,
    ...(nextFilters ? { filters: nextFilters } : {}),
  };
}

export async function makePlotConfigBreadboxModeCompatible(
  legacyPlot: DataExplorerPlotConfig
) {
  let plot = JSON.parse(JSON.stringify(legacyPlot));
  plot = await convertAllLegacyContexts(plot);

  if (plot?.dimensions) {
    for (const dimKey of Object.keys(plot.dimensions)) {
      const d = plot.dimensions[dimKey as DimensionKey]!;
      d.dataset_id = legacyPortalIdToBreadboxGivenId(d.dataset_id);

      // "custom" was never a real dimension type -- just a sentinel
      // value we had been using. We use `null` for that now.
      if (d.slice_type === "custom") {
        ((d as unknown) as DataExplorerPlotConfigDimensionV2).slice_type = null;
      }
    }
  }

  // Convert any `metadata` values from slice IDs to SliceQuery objects.
  // The two dataset fetches are gated on whether any value actually needs
  // conversion — native (already-SliceQuery) payloads skip the round-trips.
  if (plot?.metadata) {
    const hasSliceIds = Object.keys(plot.metadata).some(
      (key) => "slice_id" in plot.metadata[key]
    );

    if (hasSliceIds) {
      const datasets = await cached(breadboxAPI).getDatasets();
      const dimTypes = await cached(breadboxAPI).getDimensionTypes();

      // eslint-disable-next-line no-inner-declarations
      function maybeFallbackToMetadataDatasetNonGivenId(dataset_id: string) {
        const dimTypeName = dataset_id.replace(/_metadata$/, "");
        const dimType = dimTypes.find((dt) => dt.name === dimTypeName);

        if (dimType?.metadata_dataset_id) {
          const regularId = dimType.metadata_dataset_id;
          const dataset = datasets.find((d) => d.id === regularId);

          if (dataset && dataset.given_id !== dataset_id) {
            return regularId;
          }
        }

        return dataset_id;
      }

      for (const key of Object.keys(plot.metadata)) {
        const value = plot.metadata[key];

        if ("slice_id" in value) {
          const nextValue = sliceIdToSliceQuery(
            value.slice_id,
            "categorical",
            plot.index_type
          );

          if (nextValue.dataset_id.endsWith("_metadata")) {
            // This shouldn't bee necessary because we now auto-generate a
            // given_id for every metadata dataset. However, at least at one
            // point, there were some crufty dimension types that slipped through
            // the cracks. This accounts for that.
            nextValue.dataset_id = maybeFallbackToMetadataDatasetNonGivenId(
              nextValue.dataset_id
            );
          }

          plot.metadata[key] = nextValue;

          if (key === "color_property" && nextValue) {
            if (nextValue.identifier_type === "column") {
              plot.color_by = nextValue.dataset_id.endsWith("_metadata")
                ? "property"
                : "custom";
            } else if (
              nextValue.dataset_id === wellKnownDatasets.subtype_matrix
            ) {
              plot.color_by = "property";
            } else {
              // In some rare cases, what used to be considered a color "property"
              // (was keyed as model metadata) is now now stored in a matrix.
              // Known cases:
              // mutations_prioritized
              // mutation_protein_change
              const slice_type =
                nextValue.dataset_id === wellKnownDatasets.mutations_prioritized
                  ? "gene"
                  : null;

              plot.color_by = "custom";
              plot.dimensions.color = ({
                axis_type: "raw_slice",
                slice_type,
                aggregation: "first",
                dataset_id: nextValue.dataset_id,
                context: {
                  name: nextValue.identifier,
                  dimension_type: slice_type,
                  expr: {
                    "==": [{ var: "entity_label" }, nextValue.identifier],
                  },
                  vars: {
                    entity_label: {
                      dataset_id: maybeFallbackToMetadataDatasetNonGivenId(
                        `${slice_type}_metadata`
                      ),
                      identifier_type: "column" as const,
                      identifier: "label",
                    },
                  },
                },
              } as unknown) as DataExplorerPlotConfigDimension;
              delete plot.metadata[key];
            }
          }
        }
      }
    }
  }

  return plot;
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

  // Both live mint points stamp `version`: `plotToQueryString` (the `p` param)
  // and `parseShorthandParams` (the shorthand params). The only producers left
  // unstamped are genuinely old — the base64 `plot` param, a format we no longer
  // write, and `p` payloads minted before versioning shipped. So absent version
  // ⟹ pre-versioning legacy, and coercing it to 0 is sound rather than a guess.
  //
  // Keeping that implication TRUE is the whole job of stamping at the mint point,
  // and it is load-bearing for every future migration. A Phase B step gated on
  // `payloadVersion < N` necessarily assumes an unstamped payload was minted
  // under the old regime. Were shorthand links left unstamped, a link generated
  // one second from now would coerce to 0 and be migrated as though it were years
  // old — silently reinterpreted under semantics it was never minted under. Stamp
  // at the mint point; never sniff payload shape at the reader.
  const payloadVersion = plot?.version ?? 0;

  // Phase A: structural repairs — skipped for version >= 1, which certifies that
  // `dimensions` is already an object and all property names are canonical (no
  // legacy `entity`/`context` values for color_by/axis_type, no entity_type).
  //
  // Shorthand plots are certified by construction, not by assumption: the parser
  // only ever writes `color_by` of "aggregated_slice" | "property", `axis_type` of
  // "raw_slice" | "aggregated_slice", always `slice_type` (never `entity_type`),
  // and always an object `dimensions`. Phase A was already a no-op on them before
  // they carried a version; stamping simply lets us skip the no-op honestly.
  if (payloadVersion < 1) {
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
  }

  // Strip version before the plot enters memory. It's a wire-only field;
  // leaving it in would cause plotsAreEquivalentWhenSerialized to see spurious
  // diffs between a loaded plot and an otherwise-identical in-memory one.
  if (plot) {
    delete plot.version;
  }

  // Phase B migrations go here, gated on `payloadVersion` — the coerced local
  // captured above, NOT `plot.version`. The reason isn't only that `plot.version`
  // has been deleted; it's that `plot.version` is undefined for the ENTIRE
  // pre-versioning cohort regardless of where the strip sits, and
  // `undefined < 2` evaluates to false, which would silently skip the legacy
  // payloads a migration exists to upgrade while appearing to work on v1+.
  // The `?? 0` coercion is the only thing that makes `0 < 2 === true` for that
  // cohort. Do not "fix" this by moving the strip — the silent-skip failure mode
  // is independent of strip placement. Each migration should be its own named
  // step, not folded into Phase A's block.
  // Example slot: if (payloadVersion < 2) { /* color_by flip migration */ }
  //
  // replaceHashesWithContexts and makePlotConfigBreadboxModeCompatible are
  // unconditional regardless of version, for two independent reasons:
  //   1. `version` certifies SCHEMA vintage, never backend-nativity. A payload can
  //      be honestly v1 and still carry backend-legacy forms. Shorthand is the
  //      proof: parseShorthandParams matches legacy dataset IDs via
  //      legacyPortalIdToBreadboxGivenId but writes the RAW id, deliberately
  //      deferring the rewrite to here; it likewise emits context_type contexts,
  //      the "custom" slice_type sentinel, and slice_id metadata. A hand-written
  //      or LLM-generated v1 URL can do the same. For those inputs these passes
  //      are LOAD-BEARING, not idempotent no-ops. Never gate them on version.
  //   2. Context hashes resolve to contexts persisted by any client vintage, so
  //      V1→V2 conversion happens at point-of-dereference inside
  //      replaceHashesWithContexts, keyed on the context's shape, not the plot's
  //      version.
  // The function is additionally idempotent on already-native input, so running
  // it unconditionally is cheap.
  plot = await replaceHashesWithContexts(plot);

  if (plot) {
    plot = await makePlotConfigBreadboxModeCompatible(plot);
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
