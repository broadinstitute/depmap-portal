import stableStringify from "json-stable-stringify";
import {
  FilterKey,
  isValidSliceQuery,
  PartialDataExplorerPlotConfig,
  SliceQuery,
} from "@depmap/types";
import { isPartialSliceId } from "../../utils/misc";
import { isCompleteDimension } from "../../utils/dimensionHelpers";

// Split out of utils.ts so that plotConfigReducer can import these without
// forming a cycle (utils.ts itself uses the reducer).

// `color_by` and `facet_by` share five real, symmetric values (raw_slice,
// aggregated_slice, property, custom, expansion) backed by a symmetric set
// of fields (filters.color1/2 <-> facet1/2, metadata.color_property <->
// facet_property, dimensions.color <-> facet). Beyond those five,
// `color_by` alone has two sentinel values with no `facet_by` equivalent:
// "facet" (defer to facet_by — also what an absent color_by means) and
// "uniform" (explicit no-color). A full two-way swap is only well-defined
// when BOTH axes hold one of the five real values — there's no sensible
// destination value for the other axis otherwise (a "smart" translated swap
// for those cases was considered and deliberately not built; see ADR 0004).
//
// Two narrower, one-way cases are also well-defined and worth exposing,
// since each has an unambiguous destination even though only one axis holds
// a real value:
//   - "promote": facet_by is unset and color_by holds a real, complete
//     value — move it (mode + backing) over to become facet_by, with
//     color_by rewritten to "facet" (deferring back to it). This is the
//     live-UI equivalent of the v1->v2 color_by migration in
//     readPlotFromQueryString.
//   - "demote": color_by defers to facet_by ("facet") and facet_by holds a
//     real, complete value — move it (mode + backing) over to become
//     color_by, with facet_by unset entirely. The mirror image of promote.
//
// `SWAPPABLE_AXIS_VALUES` membership is checked on both `color_by` and
// `facet_by` — `facet_by` should never actually hold "facet"/"uniform"
// under normal reducer flows, but a hand-authored link could set it, and
// this is the one place both the UI (button visibility) and the reducer
// (its own no-op guard) rely on, so it must be correct regardless of how a
// bad value got there.
const SWAPPABLE_AXIS_VALUES = new Set([
  "raw_slice",
  "aggregated_slice",
  "property",
  "custom",
  "expansion",
]);

export type SwappablePlot = Pick<
  PartialDataExplorerPlotConfig,
  "color_by" | "facet_by" | "filters" | "metadata" | "dimensions" | "expand_by"
>;

// Mirrors normalizePlot's own per-mode completeness checks (deliberately not
// reused directly — normalizePlot also handles unrelated concerns like
// sort_by/hide_points and expects a full DataExplorerPlotConfig, not this
// function's narrower Partial slice). An axis "counts" only once its own
// mode has real backing, not merely a mode selected in the dropdown — e.g.
// color_by: "property" with no metadata.color_property yet (annotation not
// chosen) is a genuine, valid in-progress editing state, and swapping mid
// -selection would be confusing rather than useful.
export function isAxisComplete(
  mode: string | undefined,
  target: "color" | "facet",
  plot: SwappablePlot
): boolean {
  switch (mode) {
    case "raw_slice":
    case "aggregated_slice":
      return Boolean(
        plot.filters?.[`${target}1` as FilterKey] ||
          plot.filters?.[`${target}2` as FilterKey]
      );
    case "property": {
      const property = plot.metadata?.[`${target}_property`];
      if (!property) {
        return false;
      }
      // Cast past PartialDeep: `plot` is built from PartialDataExplorerPlotConfig
      // (recursively-partial, for in-progress editing states), which is
      // stricter than these validators need — they already handle missing
      // fields gracefully at every level.
      return "slice_id" in property
        ? !isPartialSliceId(
            (property as { slice_id?: string }).slice_id ?? null
          )
        : isValidSliceQuery(property as Partial<SliceQuery>);
    }
    case "custom": {
      const dimension = plot.dimensions?.[target];
      return Boolean(dimension && isCompleteDimension(dimension));
    }
    case "expansion":
      return Boolean(plot.expand_by?.length);
    default:
      return false;
  }
}

// True when color_by/facet_by already resolve to the exact same thing, so a
// swap would be a visible no-op. `expand_by` is shared/target-agnostic (not
// per-axis backing), so two "expansion" axes are trivially the same
// partition already.
function axesAlreadyMatch(
  colorMode: string | undefined,
  plot: SwappablePlot
): boolean {
  if (plot.color_by !== plot.facet_by) {
    return false;
  }

  switch (colorMode) {
    case "raw_slice":
    case "aggregated_slice":
      return (
        stableStringify(plot.filters?.color1) ===
          stableStringify(plot.filters?.facet1) &&
        stableStringify(plot.filters?.color2) ===
          stableStringify(plot.filters?.facet2)
      );
    case "property":
      return (
        stableStringify(plot.metadata?.color_property) ===
        stableStringify(plot.metadata?.facet_property)
      );
    case "custom":
      return (
        stableStringify(plot.dimensions?.color) ===
        stableStringify(plot.dimensions?.facet)
      );
    case "expansion":
      return true;
    default:
      return false;
  }
}

export type ColorFacetSwapMode = "swap" | "promote" | "demote";

// Which of the three exchanges described above the current config supports, or
// null when it supports none.
//
// Split out from canSwapColorAndFacet — now just "is there one" — because the
// button has to NAME the action, and only the two-way case is a swap in any
// sense a reader would recognize. Promote leaves color deferring to the facet
// it just created, so both end up showing the same partition; demote leaves
// color holding what facet had and facet unset. Deriving the label and the
// visibility from one function is what keeps the two from drifting apart.
export function getColorFacetSwapMode(
  plot: SwappablePlot
): ColorFacetSwapMode | null {
  const { color_by, facet_by } = plot;

  const colorIsReal = SWAPPABLE_AXIS_VALUES.has(color_by as string);
  const colorComplete = colorIsReal && isAxisComplete(color_by, "color", plot);
  const facetComplete =
    SWAPPABLE_AXIS_VALUES.has(facet_by as string) &&
    isAxisComplete(facet_by, "facet", plot);

  // Standard case: both axes already hold one of the five real, shared
  // values, both complete, and not already matching — full two-way swap.
  if (colorComplete && facetComplete) {
    return axesAlreadyMatch(color_by, plot) ? null : "swap";
  }

  // Promote: facet_by is unset and color_by holds a real, complete value.
  if (!facet_by && colorComplete) {
    return "promote";
  }

  // Demote: facet_by holds a real, complete value, and color_by is either
  // deferring to it (explicitly via "facet", or implicitly by being absent
  // — resolveColorMode treats the two identically) or holds a real mode
  // that's still mid-selection (e.g. "property" with no annotation chosen
  // yet). None of those leave anything on the color side worth preserving,
  // so it's safe to discard in favor of facet's already-complete selection.
  // Deliberately does NOT cover "uniform" — that's a complete, deliberate
  // choice (explicit no-color) rather than a deferred/interrupted one, so
  // it remains a no-op.
  if (
    facetComplete &&
    (color_by === "facet" || !color_by || (colorIsReal && !colorComplete))
  ) {
    return "demote";
  }

  return null;
}

export function canSwapColorAndFacet(plot: SwappablePlot): boolean {
  return getColorFacetSwapMode(plot) !== null;
}

// Whether `show_regression_line_per_color` has anything to mean: there must be
// panels to split (a complete facet_by) AND a color partition of its own to
// split them by (a complete color_by that isn't just facet_by under another
// name). Everything else already draws exactly one line per panel, so the
// option would be a checkbox with no effect.
//
// Same three conditions as the "swap" arm of getColorFacetSwapMode, and
// deliberately not written as `getColorFacetSwapMode(plot) === "swap"`: the two
// answer different questions and only coincide today. Reusing the swap mode
// here would silently redefine this option the next time swappability changes
// (e.g. if ADR 0004's "smart translated swap" is ever built).
//
// Config-level only. Two axes naming the *same* underlying annotation through
// different modes still read as different here; that case resolves to one
// partition in the data (colorMatchesFacet in useScatterPlotData) and is
// caught there, where the response is available.
export function canShowRegressionLinePerColor(plot: SwappablePlot): boolean {
  const { color_by, facet_by } = plot;

  const colorComplete =
    SWAPPABLE_AXIS_VALUES.has(color_by as string) &&
    isAxisComplete(color_by, "color", plot);

  const facetComplete =
    SWAPPABLE_AXIS_VALUES.has(facet_by as string) &&
    isAxisComplete(facet_by, "facet", plot);

  return colorComplete && facetComplete && !axesAlreadyMatch(color_by, plot);
}
