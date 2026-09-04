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
import {
  getExpansionAxes,
  getExpansionAxis,
  isExpansionDimension,
} from "../../../utils/misc";
import { contextsMatch } from "../../../utils/context";
import {
  canShowRegressionLinePerColor,
  canSwapColorAndFacet,
  isAxisComplete,
  SwappablePlot,
} from "../utils";

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
  | { type: "select_show_regression_line_per_color"; payload: boolean }
  | {
      type: "select_scatter_y_slice";
      payload: {
        dataset_id: string;
        slice_label: string;
        slice_type: string;
        given_id: string;
      };
    }
  // Sets, changes, or unsets an axis's choice to expand its context rather
  // than aggregate it. Which of the three the reducer performs depends on
  // whether another axis is already expanding — see the case body.
  | {
      type: "select_expansion";
      payload: {
        // The axis making the choice.
        key: DimensionKey;
        // That axis's selection, or null for "go back to aggregating".
        expand_by: {
          // Ignored when another axis already defines an expansion: this axis
          // is joining that one, and adopting its members is the whole point.
          // Callers pass their own values regardless (they have them, since
          // this is just the axis's own dimension) rather than having to know
          // which case they're in.
          slice_type: string;
          context: DataExplorerContextV2;
          // Dataset this axis reads its per-member values from. Always this
          // axis's own, never inherited — a joining axis differs from the
          // defining one in exactly this field, which is what makes
          // "short-read vs long-read over the same transcripts" expressible.
          dataset_id: string;
        } | null;
      };
    }
  // Pins the expansion to a member set the user chose by hand, or hands the
  // choice back to the ranking. Separate from `select_expansion` because it
  // says nothing about which axis expands or over what — only which of the
  // members that axis already has should be drawn.
  | {
      type: "select_expansion_members";
      // The chosen ids, or null to go back to automatic. An empty array is
      // treated as null: "show none of them" isn't a plot anyone wants, and
      // the table can't distinguish it from a mis-click.
      payload: string[] | null;
    }
  // Pins a color or facet partition to categories the user picked by hand, or
  // hands the choice back to the ranking. Says nothing about what backs the
  // partition — only which of the categories it already has should be drawn
  // as themselves.
  | {
      type: "select_categories";
      payload: {
        // The RESOLVED target, not the raw config field. When color_by defers
        // to facet_by there is one partition and it resolves as "facet"; the
        // caller has already done that resolution to render the control.
        target: "color" | "facet";
        // The chosen names, or null to go back to automatic. An empty array is
        // treated as null: a plot showing no categories isn't a plot.
        categories: string[] | null;
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

  // Hand-picked categories belong to a partition. When the partition goes, so
  // do they — otherwise they sit in the config invisibly and reassert
  // themselves the moment color or facet is switched back on, against whatever
  // annotation is backing it by then.
  //
  // Only the "there is no partition at all" case is detectable here; a change
  // of *backing* is not, since normalize sees one plot and not what preceded
  // it. The actions that change a backing clear their own list. That is the
  // weaker arrangement, and it is tolerable only because a stale name is inert
  // by construction: getShownCategories intersects with what the data actually
  // has and falls back to ranking when nothing survives. The exception worth
  // the belt-and-braces is two annotations that share category names, where a
  // missed clear would silently constrain the new one instead of being ignored.
  if (!nextPlot.color_by || nextPlot.color_by === "uniform") {
    nextPlot = omit(nextPlot, "color_categories");
  }

  if (!nextPlot.facet_by) {
    nextPlot = omit(nextPlot, "facet_categories");
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

  // The per-color split only exists while color_by and facet_by are two real,
  // distinct partitions — the same condition that shows its checkbox. Dropped
  // the moment that stops holding (color_by switched to "uniform"/"facet",
  // facet_by cleared, either axis pointed at what the other already shows), so
  // it can't sit in the config invisibly and reassert itself later, the same
  // reasoning as the hand-picked categories above. Checked against `nextPlot`,
  // so an axis this same normalize pass just cleared already counts as gone.
  //
  // And, like the categories, this only sees "there is no distinct partition
  // any more", not a change of *backing* that happens to converge the two axes
  // (select_color_property returns without normalizing). That leftover is inert
  // rather than merely unlikely: useScatterPlotData won't draw a per-color
  // split while colorMatchesFacet, and normalizePlot re-checks before anything
  // is serialized.
  if (
    plot.show_regression_line_per_color === false ||
    plot.plot_type !== "scatter" ||
    !canShowRegressionLinePerColor(nextPlot)
  ) {
    nextPlot = omit(nextPlot, "show_regression_line_per_color");
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

  // An expanding axis reads its values by looking the expansion's members up
  // in its own dataset, on the axis implied by its `slice_type`. So a
  // `slice_type` that disagrees with the expansion's doesn't error — it finds
  // nothing, and the axis silently goes all-null. Demote any such dimension
  // back to aggregating instead.
  //
  // This is the backstop for every route that can pull an axis out from under
  // an expansion without going through `select_expansion`: an inferred
  // slice_type after a data-type change, a whole-dimension `select_dimension`,
  // a hand-authored link. The defining axis can never trip it (the reducer
  // writes both copies from one source), so in practice this catches a joining
  // axis being repointed at something else.
  //
  // The same demotion cleans up a sentinel on `color` or `facet`, which cannot
  // expand at all. Repairing it here rather than leaving it to the
  // materializer's own guard means a hand-authored link renders — with that
  // dimension aggregated — instead of erroring at someone who only clicked it.
  // The guard stays as the backstop for callers that bypass the reducer.
  const expansionSliceType = plot.expand_by?.[0]?.slice_type;

  const mismatchedExpansionAxes = Object.entries(plot.dimensions ?? {}).filter(
    ([key, dim]) =>
      isExpansionDimension(dim) &&
      ((key !== "x" && key !== "y") || dim?.slice_type !== expansionSliceType)
  );

  if (mismatchedExpansionAxes.length > 0) {
    const dimensions = { ...nextPlot.dimensions };

    mismatchedExpansionAxes.forEach(([key]) => {
      dimensions[key as DimensionKey] = {
        ...dimensions[key as DimensionKey],
        aggregation: "mean",
      };
    });

    nextPlot = { ...nextPlot, dimensions };
  }

  // Keep `expand_by` only while it's non-empty AND some AXIS still carries the
  // expansion sentinel. Overwriting the expanding axis with a plain dimension
  // orphans the sentinel, so this drops `expand_by` on its own — no
  // caller-side bookkeeping or action ordering required. (Checked against
  // `nextPlot`, so an axis just demoted above counts as gone.)
  //
  // Axes specifically, via getExpansionAxes, not every dimension. `color` and
  // `facet` cannot expand — the materializer rejects it, and the UI never
  // offers it — so counting them here would keep `expand_by` alive on the
  // strength of a dimension that will never be materialized per-pair, and
  // leave its context outside the reconciliation below.
  const hasExpansionAxis = getExpansionAxes(nextPlot).length > 0;

  if (!plot.expand_by || plot.expand_by.length === 0 || !hasExpansionAxis) {
    nextPlot = omit(nextPlot, "expand_by");
  }

  // `color_by`/`facet_by` of "expansion" partition points by their expansion
  // member, so an expansion has to exist for them to mean anything — the
  // renderer throws outright ("mode 'expansion' requires the response to have
  // at least one expansion") rather than degrading. Whenever `expand_by` goes,
  // they go with it.
  //
  // This lives here, not in `select_expansion`, because the expansion can be
  // lost by routes that never touch that action: switching a scatter to a 1D
  // plot drops `dimensions.y`, and if y was the only expanding axis the whole
  // expansion goes with it. Cleaning up at the point where `expand_by` is
  // dropped covers every such route at once.
  //
  // Cleared rather than remapped. Nothing else in the plot says what the user
  // would have wanted instead, and an absent `color_by` already means "match
  // facet_by" (schema version 2), so dropping both lands on the uncolored,
  // unfaceted plot they had before expanding — not on some invented default.
  if (!nextPlot.expand_by) {
    if (nextPlot.facet_by === "expansion") {
      nextPlot = omit(nextPlot, "facet_by");
    }

    if (nextPlot.color_by === "expansion") {
      nextPlot = omit(nextPlot, "color_by");
    }
  }

  // The members are stated on `expand_by` AND on every expanding dimension
  // (ADR 0007 §4), so something has to keep those copies in agreement. Doing
  // it here rather than only in `select_expansion` is what makes the
  // redundancy safe: any route that edits a dimension's context — the Context
  // Builder's save path writes `dimensions[key].context` straight onto the
  // plot and never touches `expand_by` — is reconciled rather than silently
  // leaving the plot describing two different member sets.
  //
  // The defining axis wins, since it is the one whose context the user
  // actually edits; `expand_by` follows it, and any joining axis follows
  // `expand_by`. A joining axis has no member set of its own to defend, so
  // editing its context is reverted rather than honored.
  const liveExpansion = nextPlot.expand_by?.[0];
  const expandingKeys = getExpansionAxes(nextPlot);
  const definingKey = expandingKeys[0];

  // The defining axis is the source of truth when it has a context, since it
  // is the one whose context the user actually edits. Falling back to
  // `expand_by`'s copy covers the reverse case — a joining axis edited while
  // the definer stayed put — where reverting to `expand_by` is what pulls the
  // joiner back into line.
  const authoritative =
    (definingKey ? nextPlot.dimensions?.[definingKey]?.context : undefined) ??
    liveExpansion?.context;

  if (liveExpansion && authoritative) {
    const matches = (other: unknown) =>
      contextsMatch(
        (other as DataExplorerContextV2) ?? null,
        (authoritative as DataExplorerContextV2) ?? null
      );

    // Deliberately narrower than `outOfSync` below. Hand-picked members are ids
    // drawn from a particular member set, so they only survive as long as it
    // does — a different gene has different transcripts, and the old ids name
    // nothing. But `outOfSync` is also true when only a JOINING axis drifted,
    // and in that case `expand_by`'s own context is unmoved, the member set is
    // unchanged, and throwing the user's selection away would be gratuitous.
    const membersAreStale = !matches(liveExpansion.context);

    const outOfSync =
      membersAreStale ||
      expandingKeys.some(
        (key) => !matches(nextPlot.dimensions?.[key]?.context)
      );

    if (outOfSync) {
      const dimensions = { ...nextPlot.dimensions };

      expandingKeys.forEach((key) => {
        dimensions[key] = { ...dimensions[key], context: authoritative };
      });

      // Spread, so anything else on the expansion rides through — but
      // `members` must not, hence the explicit drop. This is the one field
      // whose meaning depends on the context it sits next to.
      const nextExpansion = { ...liveExpansion, context: authoritative };

      nextPlot = {
        ...nextPlot,
        expand_by: [
          membersAreStale ? omit(nextExpansion, "members") : nextExpansion,
        ],
        dimensions,
      };
    }
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
    //
    // "known to be valid" is doing a lot of work in that sentence, and the
    // third case is where it broke down: the Context Builder's save path
    // assembles a plot by hand, writing `dimensions[key].context` and nothing
    // else, so editing the context of an expanding axis left `expand_by` still
    // describing the members the user had just replaced. Normalizing here
    // reconciles that instead of trusting the caller — for a genuinely
    // well-formed plot it is a no-op, which is the point.
    case "set_plot":
      return normalize(action.payload as PartialDataExplorerPlotConfig);

    case "select_plot_type": {
      const nextPlotType = action.payload;

      if (!plot.dimensions?.x) {
        return {
          ...plot,
          plot_type: nextPlotType,
        };
      }

      let dx = plot.dimensions.x;

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
        dimensions: { x: dx },
      };

      if (nextPlotType === "scatter") {
        nextPlot.dimensions!.y = {};
      }

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
        if (dx.slice_type === null) {
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
      //
      // `expand_by` goes for the same reason, and is the one field here whose
      // absence would outlive this action: an expansion's members must sit on
      // the axis opposite the index, so a new index_type can invalidate the
      // pairing outright rather than merely orphaning it. This case is also
      // the only one that returns without normalize(), so nothing else was
      // going to drop it until the next action that does normalize — leaving
      // a stale expansion (context, pinned members and all) sitting beside
      // freshly wiped dimensions in the meantime.
      const nextPlot = omit(
        {
          ...plot,
          index_type,
          dimensions:
            plot.plot_type === "scatter" ? { x: {}, y: {} } : { x: {} },
        },
        ["color_by", "facet_by", "filters", "metadata", "expand_by"]
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
        // A different partition, so a choice made against the old one says
        // nothing about this one.
        ...omit(plot, "color_categories"),
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
          ...omit(plot, "facet_by", "facet_categories"),
          dimensions,
          filters,
          metadata,
        });
      }

      return normalize(
        maybeDefaultFacetSortBy(plot, {
          // A different partition, so a choice made against the old one says
          // nothing about this one.
          ...omit(plot, "facet_categories"),
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
      // The hand-picked lists travel with the partitions they describe. They
      // are top-level rather than nested in the structures swapped below, so
      // they have to be carried explicitly or a swap would silently apply
      // color's choice to facet's categories.
      const {
        color_categories,
        facet_categories,
        ...restPlot
      } = plot as typeof plot & {
        color_categories?: string[];
        facet_categories?: string[];
      };

      const swappedCategories = {
        ...(facet_categories && { color_categories: facet_categories }),
        ...(color_categories && { facet_categories: color_categories }),
      };

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
          ...restPlot,
          // Color's choice moves with color's backing, and color now defers,
          // so it is read as facet's from here on.
          ...(color_categories && { facet_categories: color_categories }),
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
              ...restPlot,
              ...(facet_categories && { color_categories: facet_categories }),
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
        ...restPlot,
        ...swappedCategories,
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

    case "select_categories": {
      const { target, categories } = action.payload;
      const key = target === "facet" ? "facet_categories" : "color_categories";

      if (!categories || categories.length === 0) {
        return normalize(omit(plot, key));
      }

      return normalize({ ...plot, [key]: categories });
    }

    case "select_color_property": {
      const sliceQuery = action.payload;

      if (sliceQuery === null) {
        return normalize({
          ...omit(plot, "color_categories"),
          metadata: omit(plot.metadata, "color_property"),
        });
      }

      // A different annotation has different categories, so the old choice
      // goes with it.
      return {
        ...omit(plot, "color_categories"),
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
          ...omit(plot, "facet_categories"),
          metadata: omit(plot.metadata, "facet_property"),
        });
      }

      return maybeDefaultFacetSortBy(plot, {
        ...omit(plot, "facet_categories"),
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
          ...omit(plot, "color_categories"),
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

    case "select_show_regression_line_per_color": {
      if (plot.plot_type !== "scatter") {
        window.console.warn(
          "`show_regression_line_per_color` is only supported by the 'scatter' plot type."
        );
      }

      return normalize({
        ...plot,
        show_regression_line_per_color: action.payload,
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

      // Which OTHER axes are already expanding. This is what distinguishes the
      // three things this action does — define, join, or leave — so it's
      // computed once up front.
      const otherExpandingAxes = getExpansionAxes(plot).filter(
        (k) => k !== key
      );

      // Leave: this axis stops expanding and goes back to a plain aggregation.
      // We don't stash the pre-expansion dimension, so this resets
      // `aggregation` to a default rather than restoring prior state;
      // `slice_type` and `context` are left as-is, which is exactly right —
      // "the mean over these transcripts" is the sensible thing to land on
      // after turning off "one point per transcript".
      if (expand_by === null) {
        const dimension = plot.dimensions?.[key];
        const dimensions = { ...plot.dimensions };

        if (dimension) {
          dimensions[key] = { ...dimension, aggregation: "mean" };
        }

        // If another axis is still expanding, the expansion itself survives
        // untouched (including its faceting) — only this axis left it.
        if (otherExpandingAxes.length > 0) {
          return normalize({ ...plot, dimensions });
        }

        // Teardown coupling (expansion-selection design, decision 2):
        // `color_by`/`facet_by` of "expansion" are meaningless without an
        // expansion, so losing the last expanding axis has to rewrite them.
        // That's normalize's job now — it has to handle the routes that lose
        // an expansion without coming through here anyway (a scatter becoming
        // a 1D plot drops `dimensions.y`), and stating the rule twice is how
        // the two copies drift apart. ONLY the "expansion" sentinel is reset;
        // a real faceting, e.g. an annotation, survives because it is still
        // valid on the now-unexpanded plot.
        return normalize({ ...plot, expand_by: [], dimensions });
      }

      const { dataset_id } = expand_by;
      const existing = plot.dimensions?.[key];
      const currentExpansion = plot.expand_by?.[0];

      // Join: another axis already defined the expansion, so this one adopts
      // its members wholesale — the payload's own `slice_type`/`context` are
      // deliberately ignored. Only `dataset_id` is this axis's own, which is
      // the entire point: same transcripts, different assay.
      //
      // The two axes end up indistinguishable in the config, both carrying the
      // sentinel over the same context. That's not an oversight — they really
      // are symmetric, which is why swapping axes needs no special handling.
      //
      // Gated on this axis not being the DEFINING one (see getExpansionAxis:
      // the first expanding axis owns the member set). Without that check, the
      // definer editing its own context while a joiner is attached would be
      // read as a join and silently snap back to the members it was trying to
      // change.
      const isDefiningAxis = getExpansionAxis(plot) === key;

      if (
        otherExpandingAxes.length > 0 &&
        currentExpansion &&
        !isDefiningAxis
      ) {
        // Whether this is a join at all turns on the incoming slice_type. The
        // axis can only adopt the expansion's members while it is over the same
        // type; once it isn't, forcing the expansion's slice_type back onto it
        // undoes the very change the user just made. That read as the
        // slice-type dropdown being inert — the axis snapped back, and the only
        // visible effect was the dataset disappearing, because the payload's
        // now-cleared `dataset_id` was written over the old one.
        const isStillJoining =
          expand_by.slice_type === currentExpansion.slice_type;

        // Leaving by being repointed does NOT fall through to the define branch
        // below: the user retyped one axis, they did not ask to redefine the
        // plot's whole point set and drag the other axis along with it. It just
        // stops expanding and keeps its own new selection. (normalize would
        // demote the mismatch anyway; doing it here makes the intent legible
        // rather than writing a knowingly-invalid value for cleanup.)
        return normalize({
          ...plot,
          dimensions: {
            ...plot.dimensions,
            [key]: {
              ...existing,
              axis_type: "aggregated_slice",
              slice_type: isStillJoining
                ? currentExpansion.slice_type
                : expand_by.slice_type,
              context: isStillJoining
                ? currentExpansion.context
                : expand_by.context,
              dataset_id,
              aggregation: isStillJoining ? "expansion" : "mean",
            },
          },
        });
      }

      // Define: this axis's own selection becomes the expansion. Its context
      // is mirrored onto `expand_by` — the plot-level record the materializer,
      // `color_by: "expansion"` and `facet_by: "expansion"` all read. The
      // mirroring is what lets an expanding axis stay an ordinary
      // `aggregated_slice` dimension everywhere else in the system (completeness
      // checks, context hashing, legacy conversion), which is worth more than
      // the redundancy costs. Keeping the two copies in agreement is this
      // reducer's job, and the only place it can be done.
      //
      // plot_type is intentionally left untouched: expanding is a choice about
      // how one axis resolves its context, not about how the plot is drawn (an
      // expanded density_1d or waterfall is valid and already fetchable).
      const slice_type = expand_by.slice_type;
      const context = expand_by.context;

      // Any axis that had joined the previous expansion must follow the
      // redefinition, or it would keep claiming members that are no longer the
      // plot's. If it can't follow — the new expansion is over a different
      // slice_type, so its dataset can't be indexed by these members — it
      // drops back to aggregating rather than silently reading all nulls.
      const dimensions: typeof plot.dimensions = { ...plot.dimensions };

      otherExpandingAxes.forEach((k) => {
        const dim = plot.dimensions?.[k];

        dimensions[k] =
          dim?.slice_type === slice_type
            ? { ...dim, context }
            : { ...dim, aggregation: "mean" };
      });

      dimensions[key] = {
        ...existing,
        axis_type: "aggregated_slice",
        slice_type,
        context,
        dataset_id,
        aggregation: "expansion",
      };

      // Coupling (expansion-selection design, decision 1): enabling an
      // expansion pre-installs `facet_by: "expansion"` as a ONE-TIME default —
      // the model-clean configuration the UI guides users toward. This fires
      // ONLY on the enable transition (no expansion → expansion); it is never
      // re-enforced on a later select_expansion (e.g. a context edit, or a
      // switch to a different data version), so a later user switch to null or
      // an annotation faceting is
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
          expand_by: [{ slice_type, context }],
          dimensions,
        })
      );
    }

    case "select_expansion_members": {
      const expansion = plot.expand_by?.[0];

      // Nothing to pin members to. Reachable if the panel is mid-teardown, and
      // writing an `expand_by` from here would invent an expansion out of a
      // list of ids that says nothing about which axis expands.
      if (!expansion) {
        return plot;
      }

      const members = action.payload;

      return normalize({
        ...plot,
        expand_by: [
          members && members.length > 0
            ? { ...expansion, members }
            : omit(expansion, "members"),
        ],
      });
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
