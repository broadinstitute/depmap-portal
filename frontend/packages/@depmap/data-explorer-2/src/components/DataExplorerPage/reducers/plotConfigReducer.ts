import omit from "lodash.omit";
import {
  DataExplorerContextV2,
  DataExplorerContextExpression,
  DataExplorerPlotConfig,
  DataExplorerPlotConfigDimensionV2,
  DataExplorerPlotType,
  DimensionKey,
  FilterKey,
  PartialDataExplorerPlotConfig,
  SliceQuery,
} from "@depmap/types";
import { isExpansionDimension } from "../../../utils/misc";
import { canSwapColorAndFacet, isAxisComplete, SwappablePlot } from "../utils";

// Default fan-out bound seeded onto a new expansion when the caller doesn't
// supply one. Kept here as the single source of that default. Set
// conservatively: transcript-level data is heavy, and 9 renders as a tidy 3×3
// small-multiples grid. A separate hard ceiling (MAX_EXPANSION_MEMBERS) is
// enforced independently at the materializer.
export const DEFAULT_EXPANSION_LIMIT = 9;

export type PlotConfigReducerAction =
  | { type: "set_plot"; payload: PartialDataExplorerPlotConfig }
  | { type: "select_plot_type"; payload: DataExplorerPlotType }
  | { type: "select_index_type"; payload: string }
  | {
      type: "select_dimension";
      payload: {
        key: DimensionKey;
        dimension: Partial<DataExplorerPlotConfigDimensionV2>;
      };
    }
  | {
      type: "select_filter";
      payload: {
        key: FilterKey;
        filter: DataExplorerContextV2 | null;
      };
    }
  | { type: "select_color_by"; payload: DataExplorerPlotConfig["color_by"] }
  | {
      type: "select_facet_by";
      payload: DataExplorerPlotConfig["facet_by"] | null;
    }
  | { type: "select_sort_by"; payload: DataExplorerPlotConfig["sort_by"] }
  | {
      type: "select_color_property";
      payload: SliceQuery | null;
    }
  | {
      type: "select_facet_property";
      payload: SliceQuery | null;
    }
  | {
      type: "select_legacy_color_property";
      payload: { slice_id: string | null };
    }
  | { type: "select_hide_points"; payload: boolean }
  | { type: "select_hide_identity_line"; payload: boolean }
  | { type: "select_use_clustering"; payload: boolean }
  | { type: "select_show_regression_line"; payload: boolean }
  | {
      type: "select_scatter_y_slice";
      payload: {
        dataset_id: string;
        slice_label: string;
        slice_type: string;
        given_id: string;
      };
    }
  | {
      type: "select_expansion";
      payload: {
        // Which dimension reads the per-pair value (the expanding axis).
        key: DimensionKey;
        // The expansion to apply, or null to clear it. `limit` is optional in
        // the payload; the reducer seeds DEFAULT_EXPANSION_LIMIT when absent.
        expand_by: {
          slice_type: string;
          context: DataExplorerContextV2;
          limit?: number;
          // Pagination window start (0-based). Optional; the reducer defaults
          // it to 0 when absent.
          offset?: number;
          // Dataset the reading axis reads its per-pair values from. Required:
          // enabling repoints the axis at this expansion's slice_type, so the
          // dataset must be named explicitly. Inheriting a dataset_id from a
          // differently-shaped axis (e.g. a gene-level dataset under a
          // transcript expansion) would silently read the wrong matrix.
          dataset_id: string;
        } | null;
      };
    }
  // Swaps color_by/facet_by and their backing filters/metadata/dimensions.
  // No payload — see canSwapColorAndFacet for when this is a no-op. The
  // `payload?: undefined` is otherwise-unused; it exists only so generic
  // code that accesses `action.payload` across the whole action union
  // (e.g. debug.ts's logger) keeps type-checking without a special case
  // for this one payload-less variant.
  | { type: "swap_color_and_facet"; payload?: undefined }
  // Use this to dispatch multiple actions as if
  // they were a single logical action. Example:
  //   dispatch({
  //     type: "batch",
  //     payload: [
  //       { type: "select_color_by", payload: "aggregated_slice" },
  //       { type: "select_filter", payload: { key: "color1", filter } },
  //     ],
  //   });
  | { type: "batch"; payload: PlotConfigReducerAction[] };

const DEFAULT_SORT = "alphabetical";

// Whenever a facet selection is FINALIZED — i.e. the facet axis transitions
// from having no real backing to having some (a mode was picked, and now
// the property/filter/dataset/expansion behind it actually exists) — seed
// sort_by with the same default new plots get, if the user hasn't already
// set one. Sorting is meaningless against an incomplete facet_by (there's
// nothing to sort yet, per calcDensityStats' own completeness handling), so
// it should only default in at the exact moment there's finally something
// to sort. Compares `prevPlot`'s completeness against `nextPlot`'s so this
// only fires on the true false->true transition, not on every subsequent
// edit made while the facet is already complete (which must never clobber
// a sort_by the user changed away from the default).
function maybeDefaultFacetSortBy(
  prevPlot: SwappablePlot,
  nextPlot: PartialDataExplorerPlotConfig
): PartialDataExplorerPlotConfig {
  if (nextPlot.sort_by) {
    return nextPlot;
  }

  const wasComplete = isAxisComplete(prevPlot.facet_by, "facet", prevPlot);
  const isComplete = isAxisComplete(nextPlot.facet_by, "facet", nextPlot);

  if (!wasComplete && isComplete) {
    return { ...nextPlot, sort_by: DEFAULT_SORT };
  }

  return nextPlot;
}

const isEmptyObject = (obj?: object) =>
  obj !== null && typeof obj === "object" && Object.keys(obj).length === 0;

// Strips out any optional fields that are empty objects or `false` options.
const normalize = (plot: PartialDataExplorerPlotConfig) => {
  let nextPlot = plot;

  if (isEmptyObject(plot.filters)) {
    nextPlot = omit(nextPlot, "filters");
  }

  if (isEmptyObject(plot.metadata)) {
    nextPlot = omit(nextPlot, "metadata");
  }

  if (plot.hide_points === false || plot.plot_type !== "density_1d") {
    nextPlot = omit(nextPlot, "hide_points");
  }

  if (plot.hide_identity_line === false || plot.plot_type !== "scatter") {
    nextPlot = omit(nextPlot, "hide_identity_line");
  }

  if (plot.show_regression_line === false || plot.plot_type !== "scatter") {
    nextPlot = omit(nextPlot, "show_regression_line");
  }

  if (
    plot.use_clustering === false ||
    plot.plot_type !== "correlation_heatmap"
  ) {
    nextPlot = omit(nextPlot, "use_clustering");
  }

  if (plot.plot_type !== "density_1d" && plot.plot_type !== "waterfall") {
    nextPlot = omit(nextPlot, "sort_by");
  }

  // Keep `expand_by` only while it's non-empty AND some dimension still carries
  // the expansion sentinel. Overwriting the expanding axis with a plain
  // dimension orphans the sentinel, so this drops `expand_by` on its own — no
  // caller-side bookkeeping or action ordering required.
  const hasExpansionAxis = Object.values(plot.dimensions ?? {}).some((dim) =>
    isExpansionDimension(dim)
  );

  if (!plot.expand_by || plot.expand_by.length === 0 || !hasExpansionAxis) {
    nextPlot = omit(nextPlot, "expand_by");
  }

  return nextPlot;
};

function plotConfigReducer(
  plot: PartialDataExplorerPlotConfig,
  action: PlotConfigReducerAction
): PartialDataExplorerPlotConfig {
  switch (action.type) {
    // HACK: "set_plot" is used in cases where we want to completely replace
    // the plot with something known to be valid. Some examples include:
    //
    // - Loading a plot from a URL
    // - Using "visualize selected" to derive a related plot
    // - Replacing an existing context with an edited one
    //
    // It seems we could use a "select_context" action for that last one,
    // though 🤔
    case "set_plot":
      return action.payload as PartialDataExplorerPlotConfig;

    case "select_plot_type": {
      const nextPlotType = action.payload;

      if (!plot.dimensions?.x) {
        return {
          ...plot,
          plot_type: nextPlotType,
        };
      }

      let dx = plot.dimensions.x;

      // These selections are incompatible. Take the nuclear option and wipe
      // everything.
      if (nextPlotType === "scatter" && plot.index_type === "other") {
        return {
          plot_type: nextPlotType,
          dimensions: { x: {}, y: {} },
        };
      }

      if (
        nextPlotType !== "correlation_heatmap" &&
        dx.aggregation === "correlation"
      ) {
        dx = {
          ...dx,
          aggregation: dx.axis_type === "raw_slice" ? "first" : "mean",
        };
      }

      if (nextPlotType === "correlation_heatmap") {
        if (dx.axis_type !== "aggregated_slice" && dx.context) {
          dx = omit(dx, "context");
        }

        // Edge case: Other plot types allow you to select the special value
        // "All" as a context. The correlation_heatmap does not. We can detect
        // this case by looking at the `expr`. It is set to a boolean value of
        // `true` only for this special case.
        if (dx.context && dx.context.expr === true) {
          dx = omit(dx, "context");
        }

        dx = {
          ...dx,
          axis_type: "aggregated_slice",
          aggregation: "correlation",
        };
      }

      let nextPlot: PartialDataExplorerPlotConfig = {
        ...plot,
        plot_type: nextPlotType,
        dimensions: {
          x: dx,
          ...(nextPlotType === "scatter" ? { y: {} } : {}),
        },
      };

      if (
        plot.plot_type === "correlation_heatmap" &&
        nextPlotType !== "correlation_heatmap"
      ) {
        nextPlot = omit(nextPlot, ["filters"]);
      }

      if (nextPlotType === "correlation_heatmap") {
        // facet_by has no meaning on a heatmap (no violin tracks/snakes/
        // facets to drive), same as color_by — dropped alongside it so we
        // don't leave a dangling facet_by field whose backing (filters/
        // metadata) was just wiped. dimensions.facet is already absent
        // since `dimensions` above was rebuilt from just `x` (and `y`).
        nextPlot = omit(nextPlot, [
          "color_by",
          "facet_by",
          "sort_by",
          "filters",
          "metadata",
        ]);

        // No support for custom data (there's no such thing as a "custom
        // context").
        if (dx.slice_type === "custom" || dx.slice_type === null) {
          nextPlot.dimensions!.x = omit(dx, [
            "slice_type",
            "context",
            "dataset_id",
          ]);
        }
      } else {
        // The `dimensions` object above was rebuilt from scratch (just `x`
        // and, for scatter, `y`), so any other dimension present on the
        // previous plot must be explicitly restored or it's silently
        // dropped — color_by: "custom" and facet_by: "custom" both live
        // here. Restoring only color and not facet was the bug: facet_by
        // would survive as a field but its backing would vanish, breaking
        // faceting immediately (not just on reload).
        if (plot.dimensions?.color) {
          nextPlot.dimensions!.color = plot.dimensions.color;
        }

        if (plot.dimensions?.facet) {
          nextPlot.dimensions!.facet = plot.dimensions.facet;
        }
      }

      if (nextPlotType === "scatter" && plot.index_type !== "depmap_model") {
        nextPlot.dimensions!.y = {
          slice_type: "depmap_model",
          axis_type: "raw_slice",
        };
      }

      // Scenario: a scatter with a "color by" property is switched to a 1D
      // plot.
      // How to handle: Preserve that selection and introduce a default sort.
      if (
        ["density_1d", "waterfall"].includes(nextPlotType) &&
        plot.metadata?.color_property &&
        !nextPlot.sort_by
      ) {
        nextPlot.sort_by = DEFAULT_SORT;
      }

      return normalize(nextPlot);
    }

    case "select_index_type": {
      const index_type = action.payload;

      if (index_type === plot.index_type) {
        return plot;
      }

      // A new index_type invalidates every dimension/filter/metadata
      // selection (they all targeted the old index type), so `dimensions`
      // is rebuilt from scratch below with no restoration — unlike
      // select_plot_type, there's no "same index_type, different shape"
      // case to preserve across. facet_by must be dropped here for the
      // same reason color_by already is: left in, it would survive as a
      // dangling field whose backing (dimensions.facet / filters.facet1+2 /
      // metadata.facet_property) was just wiped.
      const nextPlot = omit(
        {
          ...plot,
          index_type,
          dimensions:
            plot.plot_type === "scatter" ? { x: {}, y: {} } : { x: {} },
        },
        ["color_by", "facet_by", "filters", "metadata"]
      );

      Object.keys(nextPlot.dimensions).forEach((key) => {
        nextPlot.dimensions[key as "x" | "y"] = {
          axis_type:
            plot.plot_type === "correlation_heatmap"
              ? "aggregated_slice"
              : "raw_slice",
        };
      });

      return nextPlot;
    }

    case "select_dimension": {
      const { key, dimension } = action.payload;

      return normalize(
        maybeDefaultFacetSortBy(plot, {
          ...plot,
          dimensions: {
            ...plot.dimensions,
            [key]: dimension,
          },
        })
      );
    }

    case "select_filter": {
      const { key, filter } = action.payload;

      const filters = { ...plot.filters };

      if (filter === null) {
        delete filters[key];
      } else {
        filters[key] = filter;
      }

      return normalize(maybeDefaultFacetSortBy(plot, { ...plot, filters }));
    }

    case "select_color_by": {
      let dimensions;

      if (action.payload === "custom") {
        dimensions = {
          ...plot.dimensions,
          color: {},
        };
      } else {
        dimensions = omit(plot.dimensions, "color");
      }

      // This aggressively resets color's own filters/metadata on every mode
      // change, but must preserve facet_by's independent state — facet1/
      // facet2/dimensions.facet and metadata.facet_property survive a
      // color_by change untouched, exactly as select_facet_by preserves
      // color's state in the other direction.
      const { visible, facet1, facet2 } = plot.filters || {};
      const filters = {
        ...(visible && { visible }),
        ...(facet1 && { facet1 }),
        ...(facet2 && { facet2 }),
      };

      const { facet_property } = plot.metadata || {};
      const metadata = facet_property ? { facet_property } : {};

      return normalize({
        ...plot,
        color_by: action.payload,
        sort_by: DEFAULT_SORT,
        dimensions,
        filters,
        metadata,
      });
    }

    case "select_facet_by": {
      // Mirrors select_color_by exactly, but for facet's own backing:
      // changing facet_by clears dimensions.facet / filters.facet1+facet2 /
      // metadata.facet_property — never color's, which is preserved
      // untouched, symmetric with select_color_by preserving facet's state.
      const dimensions =
        action.payload === "custom"
          ? { ...plot.dimensions, facet: {} }
          : omit(plot.dimensions, "facet");

      const filters = omit(plot.filters, "facet1", "facet2");
      const metadata = omit(plot.metadata, "facet_property");

      // Clearing (null/undefined payload) omits the field entirely, which
      // means "no faceting" — facet_by no longer falls back to color_by in
      // any renderer.
      if (!action.payload) {
        return normalize({
          ...omit(plot, "facet_by"),
          dimensions,
          filters,
          metadata,
        });
      }

      return normalize(
        maybeDefaultFacetSortBy(plot, {
          ...plot,
          facet_by: action.payload,
          dimensions,
          filters,
          metadata,
        })
      );
    }

    case "swap_color_and_facet": {
      // canSwapColorAndFacet covers three mutually-exclusive cases — see its
      // own comment. This guard is independent of the button's own
      // visibility check (also driven by canSwapColorAndFacet), so
      // dispatching this action is safe from anywhere, not just from behind
      // that check.
      if (!canSwapColorAndFacet(plot)) {
        return plot;
      }

      const { color_by, facet_by } = plot;

      const { color1, color2, facet1, facet2, ...restFilters } =
        plot.filters || {};
      const { color_property, facet_property, ...restMetadata } =
        plot.metadata || {};
      const { color, facet, ...restDimensions } = plot.dimensions || {};

      // filters.visible and sort_by are deliberately left untouched in every
      // branch below — they aren't axis-specific.

      // Promote: facet_by is unset — move color's mode and backing over to
      // become facet_by; color_by becomes "facet" (defers back to it).
      if (!facet_by) {
        return normalize({
          ...plot,
          color_by: "facet",
          facet_by: color_by,
          filters: {
            ...restFilters,
            ...(color1 && { facet1: color1 }),
            ...(color2 && { facet2: color2 }),
          },
          metadata: {
            ...restMetadata,
            ...(color_property && { facet_property: color_property }),
          },
          dimensions: {
            ...restDimensions,
            ...(color && { facet: color }),
          },
        });
      }

      // Demote: color_by defers to facet_by (explicitly via "facet", or
      // implicitly by being absent — resolveColorMode treats the two
      // identically) or holds a real mode that's still mid-selection — move
      // facet's mode and backing over to become color_by; facet_by becomes
      // unset entirely (omitted, matching select_facet_by's own clearing
      // idiom). See canSwapColorAndFacet's matching comment for why
      // "uniform" is deliberately excluded (and thus never reaches this
      // branch, since the guard above already returned for that no-op case).
      if (color_by === "facet" || !isAxisComplete(color_by, "color", plot)) {
        return normalize(
          omit(
            {
              ...plot,
              color_by: facet_by,
              filters: {
                ...restFilters,
                ...(facet1 && { color1: facet1 }),
                ...(facet2 && { color2: facet2 }),
              },
              metadata: {
                ...restMetadata,
                ...(facet_property && { color_property: facet_property }),
              },
              dimensions: {
                ...restDimensions,
                ...(facet && { color: facet }),
              },
            },
            "facet_by"
          )
        );
      }

      // Standard: both axes already hold one of the five real, shared
      // values — full two-way exchange.
      return normalize({
        ...plot,
        color_by: facet_by,
        facet_by: color_by,
        filters: {
          ...restFilters,
          ...(facet1 && { color1: facet1 }),
          ...(facet2 && { color2: facet2 }),
          ...(color1 && { facet1: color1 }),
          ...(color2 && { facet2: color2 }),
        },
        metadata: {
          ...restMetadata,
          ...(facet_property && { color_property: facet_property }),
          ...(color_property && { facet_property: color_property }),
        },
        dimensions: {
          ...restDimensions,
          ...(facet && { color: facet }),
          ...(color && { facet: color }),
        },
      });
    }

    case "select_sort_by": {
      return normalize({
        ...plot,
        sort_by: action.payload,
      });
    }

    case "select_color_property": {
      const sliceQuery = action.payload;

      if (sliceQuery === null) {
        return normalize({
          ...plot,
          metadata: omit(plot.metadata, "color_property"),
        });
      }

      return {
        ...plot,
        metadata: {
          ...plot.metadata,
          color_property: sliceQuery,
        },
      };
    }

    case "select_facet_property": {
      const sliceQuery = action.payload;

      if (sliceQuery === null) {
        return normalize({
          ...plot,
          metadata: omit(plot.metadata, "facet_property"),
        });
      }

      return maybeDefaultFacetSortBy(plot, {
        ...plot,
        metadata: {
          ...plot.metadata,
          facet_property: sliceQuery,
        },
      });
    }

    // legacy version used a slice ID instead of SliceQuery
    case "select_legacy_color_property": {
      const { slice_id } = action.payload;

      if (slice_id === null) {
        return normalize({
          ...plot,
          metadata: omit(plot.metadata, "color_property"),
        });
      }

      return {
        ...plot,
        metadata: {
          ...plot.metadata,
          color_property: {
            slice_id,
          },
        },
      };
    }

    case "select_hide_points": {
      if (plot.plot_type !== "density_1d") {
        window.console.warn(
          "`hide_points` is only supported by the 'density_1d' plot type."
        );
      }

      return normalize({
        ...plot,
        hide_points: action.payload,
      });
    }

    case "select_hide_identity_line": {
      if (plot.plot_type !== "scatter") {
        window.console.warn(
          "`hide_identity_line` is only supported by the 'scatter' plot type."
        );
      }

      return normalize({
        ...plot,
        hide_identity_line: action.payload,
      });
    }

    case "select_use_clustering": {
      if (plot.plot_type !== "correlation_heatmap") {
        window.console.warn(
          "`use_clustering` is only supported by the 'correlation_heatmap' plot type."
        );
      }

      return normalize({
        ...plot,
        use_clustering: action.payload,
      });
    }

    case "select_show_regression_line": {
      if (plot.plot_type !== "scatter") {
        window.console.warn(
          "`show_regression_line` is only supported by the 'scatter' plot type."
        );
      }

      return normalize({
        ...plot,
        show_regression_line: action.payload,
      });
    }

    case "select_scatter_y_slice": {
      const { dataset_id, slice_label, slice_type, given_id } = action.payload;

      return {
        ...plot,
        plot_type: "scatter",
        dimensions: {
          ...plot.dimensions,
          y: {
            axis_type: "raw_slice",
            aggregation: "first",
            slice_type,
            dataset_id,
            context: {
              name: slice_label,
              dimension_type: slice_type,
              expr: {
                "==": [{ var: "given_id" }, given_id],
              } as DataExplorerContextExpression,
              vars: {},
            },
          },
        },
      };
    }

    case "select_expansion": {
      const { key, expand_by } = action.payload;

      // Clear: drop the expansion and revert the reading axis off the sentinel.
      // We don't stash the pre-expansion dimension, so this resets `aggregation`
      // to a plain default rather than restoring prior state; `slice_type` and
      // `context` are left as-is. normalize() strips the now-empty `expand_by`.
      if (expand_by === null) {
        const dimension = plot.dimensions?.[key];
        const dimensions = { ...plot.dimensions };

        if (dimension) {
          dimensions[key] = { ...dimension, aggregation: "mean" };
        }

        // Teardown coupling (expansion-selection design, decision 2):
        // `facet_by: "expansion"` is meaningless without an expansion axis, so
        // clearing the expansion must rewrite it. Reset to null (omit it)
        // rather than restoring the pre-expansion faceting — sticky-restore was
        // considered and rejected as not worth the shadow state. ONLY the
        // "expansion" sentinel is reset here; a real faceting (e.g. an
        // annotation) survives, since it's still valid on the now-unexpanded
        // plot. Do NOT generalize this to clear any facet_by.
        const cleared =
          plot.facet_by === "expansion"
            ? omit({ ...plot, expand_by: [], dimensions }, "facet_by")
            : { ...plot, expand_by: [], dimensions };

        return normalize(cleared);
      }

      // Enable: record the expansion (seeding a default limit) and reshape the
      // reading axis so (a) fetchExpandedPlot routes it as the expanding axis —
      // it matches on `axis_type: "aggregated_slice"` and `slice_type` equal to
      // the expansion's — and (b) it carries the "expansion" sentinel on
      // `aggregation`. plot_type is intentionally left untouched: expansion is
      // about the point set, not how it's rendered (an expanded density_1d or
      // waterfall is valid and already fetchable).
      const { slice_type, context, limit, dataset_id, offset } = expand_by;
      const existing = plot.dimensions?.[key];

      // Coupling (expansion-selection design, decision 1): enabling an
      // expansion pre-installs `facet_by: "expansion"` as a ONE-TIME default —
      // the model-clean configuration the UI guides users toward. This fires
      // ONLY on the enable transition (no expansion → expansion); it is never
      // re-enforced on a later select_expansion (e.g. a limit/offset/context
      // edit), so a subsequent user switch to null or an annotation faceting is
      // preserved. It deliberately OVERWRITES any prior facet_by: entering
      // expansion mode lands you in its default regardless of how the plot was
      // faceted before. Do NOT "tidy" this into an always-enforce — that would
      // clobber a deliberate departure from the default and silently break the
      // null/annotation pair configurations.
      const wasExpanded = (plot.expand_by?.length ?? 0) > 0;

      return normalize(
        maybeDefaultFacetSortBy(plot, {
          ...plot,
          ...(wasExpanded ? {} : { facet_by: "expansion" as const }),
          expand_by: [
            {
              slice_type,
              context,
              limit: limit ?? DEFAULT_EXPANSION_LIMIT,
              offset: offset ?? 0,
            },
          ],
          dimensions: {
            ...plot.dimensions,
            [key]: {
              ...existing,
              axis_type: "aggregated_slice",
              slice_type,
              context,
              dataset_id,
              aggregation: "expansion",
            },
          },
        })
      );
    }

    case "batch": {
      const thisReducer = plotConfigReducer as (
        p: PartialDataExplorerPlotConfig,
        a: PlotConfigReducerAction
      ) => PartialDataExplorerPlotConfig;

      return action.payload.reduce(thisReducer, plot);
    }

    default:
      throw new Error(`Unknown action: "${(action as { type: string }).type}"`);
  }
}

export default plotConfigReducer;
