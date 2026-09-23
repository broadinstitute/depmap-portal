import { DEFAULT_SETTINGS } from "../../../../../contexts/DataExplorerSettingsContext";
import {
  DEFAULT_RESOLUTION,
  DimensionUnit,
} from "../../../../../utils/lengthUnits";
import {
  DEFAULT_VIOLIN_LINE_WIDTH,
  ExportLegendPosition,
} from "../prototype/plotUtils";

// Deliberately opinionated defaults for an image destined for a slide, rather
// than the user's own on-screen settings. The two want different things: on
// screen a plot is viewed at 1:1 in a large panel, while in a deck it is
// scaled down to a fraction of its pixel size and then, often, projected.
//
// The arithmetic these were picked from, so it can be redone if the
// assumptions change:
//
//   A Google Slides 16:9 page is 10 x 5.625 in = 720 x 405 pt. Leave room for
//   a title and margins and the comfortable content area is roughly
//   640 x 400 pt, which is where a single plot usually lands.
//
//   Placing a 1280 px wide image in 640 pt means every image pixel becomes
//   half a point. So anything sized in the image appears at HALF that many
//   points on the slide, and that factor of two is the whole reason these
//   differ from DEFAULT_SETTINGS.
//
// Why 2x rather than 1x: at 1:1 (a 640 px image in 640 pt) the export is soft
// on every high-DPI screen and projector. 2x is the standard headroom.
export const DIMENSION_BOUNDS = { min: 100, max: 4000 };

// automargin measures actual text and grows the plot's own margin to fit it
// exactly — there's no fixed constant that also leaves the right amount of
// *extra* breathing room beyond that on every combination of axis font size
// and plot type (see exportMarginFloor). Rather than keep chasing that with
// more heuristics, this is a knob: it's there to turn up for whichever case
// still needs more than the default below gives it.
export const EDGE_PADDING_BOUNDS = { min: 0, max: 100 };

// Gridlines, axis lines and tick marks — see calcChromeAxisOverrides. 0
// hides them entirely.
export const CHROME_LINE_WIDTH_BOUNDS = { min: 0, max: 6 };

// The y=x line and regression lines — see calcPlotIndicatorLineShapes.
// Floored at 1 rather than 0: unlike chrome, there's no "hide" concept here,
// just thinner vs. thicker.
export const DATA_LINE_WIDTH_BOUNDS = { min: 1, max: 8 };

// The violin outline curve (Density 1D only) — see calcViolinOutlineWidth.
// Same floor-at-1 reasoning as DATA_LINE_WIDTH_BOUNDS: no "hide" concept.
export const VIOLIN_LINE_WIDTH_BOUNDS = { min: 1, max: 8 };

// Row/column tick labels and the colorbar's own ticks (correlation heatmap
// only). Floored well above 0 — unlike a line width, an unreadable font
// isn't a "hide" option, just a bad one — and capped modestly: a heatmap
// dense enough to need this control tuned down is also dense enough that a
// large font would force Plotly to start skipping labels, which is a
// tradeoff for whoever's exporting to strike, not a range to hide from them.
export const TICK_FONT_SIZE_BOUNDS = { min: 6, max: 24 };

const DEFAULT_EXPORT_DIMENSIONS = {
  // 16:10. Wider than the 5:4-ish 1280x1000 we used to default to, which fit a
  // 16:9 slide badly: scaled to the available height it left a third of the
  // slide empty. Not the slide's own 16:9 either — that would fill the page
  // edge to edge with no room for a title.
  //
  // The extra width is also where the legend goes. An exported image carries
  // Plotly's own legend (ours is HTML and can't be rasterized), so it needs
  // horizontal room that the on-screen plot doesn't.
  width: 1280,
  height: 800,
};

const DEFAULT_EXPORT_PLOT_STYLES = {
  ...DEFAULT_SETTINGS.plotStyles,

  // 24 px in the image reads as ~12 pt on the slide. DEFAULT_SETTINGS' 14
  // would land at 7 pt — legible on a laptop at full size, unreadable from
  // the third row.
  xAxisFontSize: 24,
  yAxisFontSize: 24,

  // Same doubling, same reason: 12 px point labels read as 6 pt on a slide.
  annotationFontSize: 24,

  // Scaled by the same factor and for the same reason: a 10 px marker becomes
  // a 5 pt dot, which reads as noise next to 14 pt type. The ratio between
  // the two is kept as DEFAULT_SETTINGS has it (faceted points are smaller
  // because faceting subdivides the plot area).
  pointSize: 14,
  facetedPointSize: 10,
};

// Preview.app's "Fit into:" menu, with the targets that actually come up here.
// Each is a pair of pixel dimensions; the print ones also carry the unit and
// resolution they were designed in, so selecting one makes the fields read in
// the terms you'd have specified it in ("7 in at 300 dpi") rather than leaving
// you to recognise 2100 px.
export interface ExportPreset {
  label: string;
  width: number;
  height: number;
  unit?: DimensionUnit;
  dpi?: number;
}

export const EXPORT_PRESETS: ExportPreset[] = [
  // The default, and the reasoning behind its shape is in
  // DEFAULT_EXPORT_DIMENSIONS above.
  { label: "Slide, full width", ...DEFAULT_EXPORT_DIMENSIONS },
  // A half-width slot on a slide is around 330 pt, so 660 px at the same 2x.
  // Squarer than the full-width case because the space is much narrower.
  { label: "Slide, half width", width: 660, height: 520 },
  // 3.5 in is the conventional single-column width in a two-column journal
  // layout; 300 dpi is the usual submission requirement.
  {
    label: "Print column, 3.5 in",
    width: 1050,
    height: 780,
    unit: "in",
    dpi: 300,
  },
  // A full 7 in text block across both columns, same resolution.
  {
    label: "Print page, 7 in",
    width: 2100,
    height: 1350,
    unit: "in",
    dpi: 300,
  },
  { label: "Square", width: 1000, height: 1000 },
];

// Everything the export modal opens with, in one object: the image's own
// dimensions belong with the styles rather than arriving separately, since
// they're chosen together and for the same reason (see the arithmetic above).
export type ExportImageFormat = "png" | "svg";

export interface ExportConfig {
  width: number;
  height: number;
  unit: DimensionUnit;
  resolution: number;
  // Shared across plot types, like width/height/unit/resolution above —
  // nothing about a plot type prefers one format over the other, this is
  // purely about what the exported file is destined for.
  format: ExportImageFormat;
  // Where the built-in legend sits in the exported image. Right spends width
  // and clips past the plot height; above spends height and wraps instead.
  // Which is better depends on the entry count, hence a per-export choice.
  legendPosition: ExportLegendPosition;
  // Extra margin, in px, beyond what the renderer's own automargin computed.
  // See EDGE_PADDING_BOUNDS.
  edgePadding: number;
  // Gridlines. See CHROME_LINE_WIDTH_BOUNDS.
  chromeLineWidth: number;
  // The y=x line and regression lines. See DATA_LINE_WIDTH_BOUNDS.
  dataLineWidth: number;
  // The violin outline curve (Density 1D only). See VIOLIN_LINE_WIDTH_BOUNDS.
  violinLineWidth: number;
  // Row/column tick labels and the colorbar's ticks (correlation heatmap
  // only). See TICK_FONT_SIZE_BOUNDS.
  tickFontSize: number;
  plotStyles: typeof DEFAULT_EXPORT_PLOT_STYLES;
}

export const DEFAULT_EXPORT_CONFIG: ExportConfig = {
  ...DEFAULT_EXPORT_DIMENSIONS,
  // Pixels to begin with: the physical units are there for people who need
  // them, not a default anyone should have to translate out of.
  unit: "px",
  resolution: DEFAULT_RESOLUTION,
  format: "png",
  // Unchanged from what exports have always done.
  legendPosition: "right",
  // Bigger than EXPORT_EDGE_PADDING (the fallback for callers that don't go
  // through this modal at all, e.g. Density 1D's direct download): with the
  // rest of these defaults sized for a slide, the labels want more room
  // around them than the old flush-to-the-edge amount gave.
  edgePadding: 15,
  // Bigger than the renderers' own no-option fallbacks (DEFAULT_CHROME_LINE_
  // WIDTH / DEFAULT_DATA_LINE_WIDTH, both sized to match the plot on
  // screen exactly) — same reasoning as edgePadding above: thin lines that
  // read fine at 1:1 get lost once an export is scaled down onto a slide,
  // so the modal opens at a size that already accounts for that instead of
  // making every export start from a value someone always has to raise.
  chromeLineWidth: 2,
  dataLineWidth: 4,
  violinLineWidth: DEFAULT_VIOLIN_LINE_WIDTH,
  // Bigger than the renderer's own no-option fallback (DEFAULT_TICK_FONT_
  // SIZE, which matches today's implicit tick font exactly) — same
  // reasoning as chromeLineWidth/dataLineWidth above: legible at 1:1 isn't
  // legible once scaled down onto a slide.
  tickFontSize: 20,
  plotStyles: DEFAULT_EXPORT_PLOT_STYLES,
};
