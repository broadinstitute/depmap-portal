// Brings any DataExplorerPlotConfig a client might send (old bookmarks, shorthand
// URLs, hand-written or LLM-generated configs) up to the current shape. This is
// part of the standalone Node bundle (see embed-frontend/webpack.node.js and
// ADR 0010), so keep it free of React, `window`, storage and import-time side
// effects. Anything that needs the browser is injected through
// `NormalizeDeps` instead of imported.
import { breadboxAPI, cached } from "@depmap/api";
import {
  DataExplorerContext,
  DataExplorerContextV2,
  DataExplorerPlotConfig,
  DataExplorerPlotConfigDimension,
  DataExplorerPlotConfigDimensionV2,
  DimensionKey,
  FilterKey,
} from "@depmap/types";
import { isV2Context, negateContext } from "./contextExpr";
import { convertContextV1toV2Core } from "./context-converter-core";
import {
  legacyPortalIdToBreadboxGivenId,
  sliceIdToSliceQuery,
} from "./slice-id";
import wellKnownDatasets from "../constants/wellKnownDatasets";

export interface NormalizeDeps {
  // Resolves a context hash (see the content-addressable storage in Breadbox).
  // The browser caches these; the Node script just asks Breadbox.
  fetchContext: (
    hash: string
  ) => Promise<DataExplorerContext | DataExplorerContextV2>;
  // Defaults to the plain conversion. The browser passes a version that also
  // shows a modal when it fails.
  convertContextV1toV2?: (
    context: DataExplorerContext
  ) => Promise<DataExplorerContextV2>;
  // The browser uses this to rewrite stored legacy contexts in localStorage.
  onLegacyContextConverted?: (
    legacyContext: DataExplorerContext,
    convertedContext: DataExplorerContextV2
  ) => void;
}

// To keep URLs reasonably short, contexts are now (often) encoded as hashes.
// This fetches the proper context objects and replaces the hashes with them.
async function replaceHashesWithContexts(
  plot: DataExplorerPlotConfig | null,
  deps: NormalizeDeps
) {
  if (!plot) {
    return null;
  }

  const convertContext = deps.convertContextV1toV2 || convertContextV1toV2Core;

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
            ? await deps.fetchContext(dimension.context.hash)
            : dimension.context;

        const context = !isV2Context(maybeLegacyContext)
          ? await convertContext(maybeLegacyContext)
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
          "hash" in filter ? await deps.fetchContext(filter.hash) : filter;

        const context = !isV2Context(maybeLegacyContext)
          ? await convertContext(maybeLegacyContext)
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
// second caller (StartScreenExample) besides the query-string reader. Do not
// gate this on payload version: the side effect (`onLegacyContextConverted`,
// which in the browser is replaceLegacyContextIfExistsInLocalStorage) must
// fire for every caller, and version describes only the `p`-param payload,
// not the StartScreen path.
async function convertAllLegacyContexts(
  plot: DataExplorerPlotConfig | null,
  deps: Pick<NormalizeDeps, "convertContextV1toV2" | "onLegacyContextConverted">
) {
  if (!plot) {
    return null;
  }

  const convertContext = deps.convertContextV1toV2 || convertContextV1toV2Core;

  const nextDimensions: any = {};
  let nextFilters: any = null;

  if (plot.dimensions) {
    await Promise.all(
      (Object.keys(plot.dimensions) as DimensionKey[]).map(
        async (dimensionKey) => {
          const dimension = plot.dimensions[dimensionKey];
          let context = dimension!.context;

          if (!isV2Context(context)) {
            const convertedContext = await convertContext(context);
            deps.onLegacyContextConverted?.(context, convertedContext);
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
          const convertedContext = await convertContext(context);
          deps.onLegacyContextConverted?.(context, convertedContext);
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
  legacyPlot: DataExplorerPlotConfig,
  deps: Pick<
    NormalizeDeps,
    "convertContextV1toV2" | "onLegacyContextConverted"
  > = {}
) {
  let plot = JSON.parse(JSON.stringify(legacyPlot));
  plot = await convertAllLegacyContexts(plot, deps);

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

          // Resolving a legacy slice_id can reveal that what was recorded as a
          // "property" isn't backed by a metadata column at all, which changes
          // the axis's mode ("property" -> "custom") and, in the matrix-backed
          // case below, replaces the metadata entry outright with a full
          // dimension.
          //
          // Keyed off the metadata key rather than hardcoding "color_property",
          // because facet_property reaches this pass by two routes and needs
          // the identical treatment: the v1 -> v2 migration in
          // readPlotFromQueryString renames color_property -> facet_property
          // BEFORE this function runs, and parseShorthandParams mints
          // facet_property directly for 1D plots. Matching only the color key
          // silently skipped both, stranding `facet_by: "property"` on a
          // matrix slice with no dimensions.facet ever built.
          const axis = ({
            color_property: "color",
            facet_property: "facet",
          } as Record<string, "color" | "facet" | undefined>)[key];

          if (axis && nextValue) {
            if (nextValue.identifier_type === "column") {
              plot[`${axis}_by`] = nextValue.dataset_id.endsWith("_metadata")
                ? "property"
                : "custom";
            } else if (
              nextValue.dataset_id === wellKnownDatasets.subtype_matrix
            ) {
              plot[`${axis}_by`] = "property";
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

              plot[`${axis}_by`] = "custom";
              plot.dimensions[axis] = ({
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

// `plot` is whatever was decoded from the wire, `version` still attached. Note
// that it is modified in place.
export async function normalizePlotConfig(
  rawPlot: DataExplorerPlotConfig | null,
  deps: NormalizeDeps
): Promise<DataExplorerPlotConfig | null> {
  let plot = rawPlot;

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
  // only ever writes `color_by` of "aggregated_slice" | "property" | "facet" |
  // "uniform" (all canonical — never the legacy "entity"/"context" spellings),
  // `axis_type` of "raw_slice" | "aggregated_slice", always `slice_type` (never
  // `entity_type`), and always an object `dimensions`. Phase A was already a no-op on them before
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
  // v1 -> v2: the color_by default flip (ADR 0001, ADR 0004). Absent color_by
  // meant "uniform" under v1; it means "facet" (defer to facet_by) under v2.
  // A v1 payload with no color_by must keep rendering exactly as it did, so
  // its historical meaning is materialized explicitly here — per ADR 0001
  // point 8, migrations write the OLD EFFECTIVE VALUE, never adopt the new
  // default. Unconditional on facet_by's presence: a v1 payload that happens
  // to already have a facet_by set must ALSO migrate to "uniform" — its
  // color_by never deferred to facet_by under v1 semantics, so leaving it
  // absent would make it start matching that facet_by under v2 read-back,
  // exactly the silent-breakage this migration exists to prevent.
  if (payloadVersion < 2 && plot && !plot.color_by) {
    plot.color_by = "uniform";
  }

  // v1 -> v2: under v1, color_by was the ONLY axis — its value drove BOTH
  // what v2 calls "color" and "facet" simultaneously (there was no
  // independent facet_by to split the two). For a v1 payload that has a real
  // color_by, keeping it rendering identically under v2 means moving that
  // value (and its backing: filters.color1/2, metadata.color_property,
  // dimensions.color) over to become facet_by's value and backing, then
  // rewriting color_by to "facet" so it defers back to that same facet_by —
  // same partition, same colors, now expressed as two independent axes that
  // happen to still match. Gated on `!plot.facet_by`, which is true for
  // every genuine v1 payload (facet_by didn't exist yet); defensively skips
  // rather than clobbers on the impossible case where one is already present.
  // Also excludes "uniform" — the sentinel the migration immediately above
  // may have just written for an originally-absent color_by; that migration
  // already ran to completion and must not be re-processed here as though
  // "uniform" were a real, migratable color_by value.
  if (
    payloadVersion < 2 &&
    plot &&
    plot.color_by &&
    plot.color_by !== "uniform" &&
    !plot.facet_by
  ) {
    plot.facet_by = plot.color_by;
    plot.color_by = "facet";

    if (plot.filters) {
      const { color1, color2, ...restFilters } = plot.filters;
      plot.filters = {
        ...restFilters,
        ...(color1 && { facet1: color1 }),
        ...(color2 && { facet2: color2 }),
      };
    }

    if (plot.metadata) {
      const { color_property, ...restMetadata } = plot.metadata;
      plot.metadata = {
        ...restMetadata,
        ...(color_property && { facet_property: color_property }),
      };
    }

    if (plot.dimensions) {
      const { color, ...restDimensions } = plot.dimensions;
      plot.dimensions = {
        ...restDimensions,
        ...(color && { facet: color }),
      } as DataExplorerPlotConfig["dimensions"];
    }
  }
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
  plot = await replaceHashesWithContexts(plot, deps);

  if (plot) {
    plot = await makePlotConfigBreadboxModeCompatible(plot, deps);
  }

  return plot;
}
