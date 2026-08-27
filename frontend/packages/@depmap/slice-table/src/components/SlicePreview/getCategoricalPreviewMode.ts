// A categorical column is often a 1-to-1 (or nearly 1-to-1) mapping of the ID
// column — think an ID, a name, or a free-text description. Plotting one bar
// per distinct value is at best uninformative and at worst fatal: BarChart
// shows a range slider above 20 categories, and dragging it relayouts every
// tick label, which locks up the browser at tens of thousands of values.

// Below this many distinct values, a bar chart is cheap and readable even if
// every value happens to be unique.
export const NEAR_UNIQUE_MIN_DISTINCT = 50;

// Fraction of values that must be distinct to call the column "nearly unique."
export const NEAR_UNIQUE_RATIO = 0.9;

// Past this many bars, browsing the distribution stops being worth it. This is
// set by legibility, not performance — the plot stays responsive well past it.
// BarChart's window holds 20 bars and `updateTickDensity` can only label ~39,
// so beyond that it keeps every k-th label by index; since bars are sorted by
// count, which ones survive is arbitrary. 150 is about 7 windows of browsing,
// which is tedious but tractable, and the range slider's overview still has a
// readable shape.
export const MAX_PLOTTABLE_CATEGORIES = 150;

// How many bars to keep when truncating. This matches BarChart's initial
// window (and its `nticks`), so the truncated plot looks like what the user
// would have seen anyway before touching the range slider. Keeping it at 20
// also keeps `showRangeSlider` false, which is what makes the window fixed.
export const TRUNCATED_CATEGORY_COUNT = 20;

export type CategoricalPreviewMode =
  // Plot every category, with the usual range slider.
  | "plot"
  // Plot only the most common categories, with the window fixed.
  | "truncate"
  // Don't plot at all — there's nothing to see.
  | "omit";

/**
 * Decide how to preview a categorical distribution.
 *
 * @param distinctCount - number of distinct values
 * @param valueCount - total number of values
 */
export default function getCategoricalPreviewMode(
  distinctCount: number,
  valueCount: number
): CategoricalPreviewMode {
  // Every bar would be the same height (or close to it), so a truncated view
  // would be just as uninformative as the full one.
  if (
    distinctCount >= NEAR_UNIQUE_MIN_DISTINCT &&
    valueCount > 0 &&
    distinctCount / valueCount >= NEAR_UNIQUE_RATIO
  ) {
    return "omit";
  }

  // The counts vary enough that the most common values are worth seeing, even
  // though there are far too many to browse.
  if (distinctCount > MAX_PLOTTABLE_CATEGORIES) {
    return "truncate";
  }

  return "plot";
}
