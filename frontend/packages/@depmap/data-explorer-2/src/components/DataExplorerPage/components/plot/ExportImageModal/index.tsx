import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Button, ButtonGroup, Modal } from "react-bootstrap";
import type Plotly from "plotly.js";
import type { DataExplorerPlotType } from "@depmap/types";
import {
  promptForValue,
  PromptComponentProps,
} from "@depmap/common-components";
import { usePlotlyLoader } from "../../../../../contexts/PlotlyLoaderContext";
import {
  Settings,
  useDataExplorerSettings,
} from "../../../../../contexts/DataExplorerSettingsContext";
import {
  BoundedStyleKey,
  isValidNumber,
  PLOT_STYLE_BOUNDS,
} from "../../../../SettingsModal/utils";
import PlotStyleFields from "../../../../SettingsModal/PlotStyleFields";
import type ExtendedPlotType from "../../../ExtendedPlotType";
import {
  captureTransientState,
  ExportLegendPosition,
  LegendInfo,
} from "../prototype/plotUtils";
import LengthInput from "../../../../LengthInput";
import {
  CHROME_LINE_WIDTH_BOUNDS,
  DATA_LINE_WIDTH_BOUNDS,
  DEFAULT_EXPORT_CONFIG,
  DIMENSION_BOUNDS,
  EDGE_PADDING_BOUNDS,
  EXPORT_PRESETS,
  ExportConfig,
  ExportImageFormat,
  TICK_FONT_SIZE_BOUNDS,
  VIOLIN_LINE_WIDTH_BOUNDS,
} from "./exportDefaults";
import {
  readRememberedExportConfig,
  rememberExportConfig,
} from "./rememberedConfig";
import {
  DimensionUnit,
  isValidResolution,
  MAX_RESOLUTION,
  MIN_RESOLUTION,
  UNIT_OPTIONS,
  UNIT_SUFFIX,
} from "../../../../../utils/lengthUnits";
import styles from "../../../styles/ExportImageModal.scss";

type PlotlyType = typeof Plotly;
type PlotStyles = Settings["plotStyles"];

export type RenderPreviewPlot = (options: {
  plotStyles: PlotStyles;
  onLoad: (plot: ExtendedPlotType) => void;
  initialAxes?: ReturnType<typeof captureTransientState>["axes"];
  initialAnnotationTails?: ReturnType<
    typeof captureTransientState
  >["annotationTails"];
  // Export-only, and outside plotStyles because it isn't a saved setting —
  // only the correlation heatmap reads it (row/column tick labels and the
  // colorbar's own ticks), but it's harmless for every other renderer's
  // `render` to just ignore an option it never asked for.
  tickFontSize?: number;
}) => React.ReactNode;

// What a wrapper must provide for the style controls to be offered at all.
// The two travel together deliberately: a caller that can draw a preview also
// knows whether this plot is faceted, and offering the controls without that
// knowledge would mean editing whichever point-size field happened to be the
// default — inert on half of all plots.
export interface PreviewPlotSupport {
  render: RenderPreviewPlot;
  // Which plotStyles field actually drives point size for this plot: the
  // faceted renderer reads facetedPointSize, the single-panel one pointSize.
  pointSizeField: "pointSize" | "facetedPointSize";
  // The same object the renderer's own `legendForDownload` prop already is
  // — not reconstructable from `plot.layout` the way axis labels are (the
  // real legend is custom HTML, never part of Plotly's layout at all), so
  // it has to be handed over explicitly. Absent when the plot has no
  // legend to begin with (no color-by).
  legend?: LegendInfo;
  // Whether this plot type ever draws y=x/regression lines. Defaults to
  // true (scatter and small multiples both support them); Density 1D sets
  // this to false since it has no such lines regardless of config.
  hasDataLines?: boolean;
  // Whether the y-axis has a single, real title that can be overridden.
  // Defaults to true; Density 1D sets this to false since its y-axis is a
  // synthetic jitter value, not a labeled axis.
  hasYAxisLabel?: boolean;
  // Whether this plot type draws violin outlines. Defaults to false —
  // opposite of the other two flags, since only Density 1D has violins at
  // all; it sets this to true.
  hasViolinLines?: boolean;
  // Whether point size/opacity, outline width and point-label font size do
  // anything here. Defaults to true; the correlation heatmap sets this to
  // false — it has no points and no annotations, so every one of those
  // style fields would be dead controls.
  hasPointStyles?: boolean;
  // Whether the per-tick font (row/column labels, and — since they're
  // controlled together — the colorbar's own tick font) is independently
  // tunable here. Defaults to false, opposite of hasPointStyles: only the
  // correlation heatmap has this many small labels whose legibility trades
  // off against how many of them fit before Plotly starts skipping some.
  hasTickFontSize?: boolean;
  // Whether there's a second heatmap panel (the "distinguish" split) with
  // its own x-axis title to relabel. Defaults to false; the correlation
  // heatmap sets this per-export, since whether the second panel exists
  // depends on the current data, not just the plot type.
  hasSecondaryXAxisLabel?: boolean;
}

interface Props {
  plot: ExtendedPlotType;
  filename: string;
  onHide: () => void;
  previewPlot?: PreviewPlotSupport;
  // Namespaces remembered settings — see rememberedConfig's own comment on
  // why chromeLineWidth and friends are kept separate per plot type, while
  // width/height/unit/resolution stay shared across all of them.
  plotType: DataExplorerPlotType;
}

const { min: MIN_DIMENSION, max: MAX_DIMENSION } = DIMENSION_BOUNDS;

// Coarser than the number input's, so that a drag across the whole track is a
// manageable number of re-renders. Typing still gets you any value you like.
const SLIDER_STEP = 20;

const clampForSlider = (value: number) => {
  if (Number.isNaN(value)) {
    return MIN_DIMENSION;
  }

  return Math.min(MAX_DIMENSION, Math.max(MIN_DIMENSION, value));
};

// How long to wait after the last edit before re-rasterizing. Each
// regeneration replots the whole figure into a detached div, so this is a real
// cost on a large plot, not just a paint.
const DEBOUNCE_MS = 400;

// The "outer" half of edgePadding — see the note in PrototypeScatterPlot's
// getImageFigure on why this can't be done through Plotly's own margin:
// automargin always sizes to fit its content exactly, with no slack by
// design, and there's no property meaning "leave some room past the title
// for no reason." So this adds it as an actual border on the finished
// raster instead, where Plotly's layout engine has no say: render the plot
// slightly smaller than requested, then paste it into the true output size,
// offset by `padding` from the left and bottom only — the two edges this
// exists for.
function padOuterEdge(
  dataUrl: string,
  width: number,
  height: number,
  padding: number,
  backgroundColor: string
): Promise<string> {
  if (padding <= 0) {
    return Promise.resolve(dataUrl);
  }

  return new Promise((resolve, reject) => {
    const image = new Image();

    image.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext("2d");

      if (!ctx) {
        resolve(dataUrl);
        return;
      }

      ctx.fillStyle = backgroundColor;
      ctx.fillRect(0, 0, width, height);
      ctx.drawImage(image, padding, 0, width - padding, height - padding);

      resolve(canvas.toDataURL("image/png"));
    };

    image.onerror = reject;
    image.src = dataUrl;
  });
}

const SVG_NAMESPACE = "http://www.w3.org/2000/svg";

// SVG's own equivalent of padOuterEdge above — same "render smaller, then
// place it inside the true output size, offset from the left and bottom
// only" idea, but without ever rasterizing: shifting a viewBox's origin
// moves what it shows without scaling it (the viewBox's *width*/*height*
// stay equal to the physical width/height, so nothing stretches), which is
// exactly a pixel-for-pixel offset. A content point at user-space x=0 lands
// at physical x = `0 - minX` — set minX to `-padding` and it lands at
// `padding`, open canvas from the left; minY stays 0, so the content's own
// bottom edge (at its rendered height, short of the full height by
// `padding`) is what opens the gap at the bottom. Text stays text, paths
// stay paths — nothing here ever touches a <canvas>.
export function padOuterEdgeSvg(
  dataUrl: string,
  width: number,
  height: number,
  padding: number,
  backgroundColor: string
): string {
  if (padding <= 0) {
    return dataUrl;
  }

  const commaIndex = dataUrl.indexOf(",");

  if (commaIndex === -1) {
    return dataUrl;
  }

  const svgString = decodeURIComponent(dataUrl.slice(commaIndex + 1));
  const doc = new DOMParser().parseFromString(svgString, "image/svg+xml");
  const root = doc.documentElement;

  if (root.nodeName !== "svg" || doc.querySelector("parsererror")) {
    return dataUrl;
  }

  root.setAttribute("width", String(width));
  root.setAttribute("height", String(height));
  root.setAttribute("viewBox", `-${padding} 0 ${width} ${height}`);

  // Plotly's own background rect (already in the document) is sized and
  // positioned to cover only the plot's own rendered area — this one
  // covers the newly-opened margin too, sitting behind it.
  const background = doc.createElementNS(SVG_NAMESPACE, "rect");
  background.setAttribute("x", String(-padding));
  background.setAttribute("y", "0");
  background.setAttribute("width", String(width));
  background.setAttribute("height", String(height));
  background.setAttribute("fill", backgroundColor);
  root.insertBefore(background, root.firstChild);

  const serialized = new XMLSerializer().serializeToString(root);
  return `data:image/svg+xml,${encodeURIComponent(serialized)}`;
}

// The single-panel renderers give an axis a native title; the faceted one
// has no such thing — its shared axis label is a paper-anchored annotation
// instead (see SmallMultiplesScatter), identified the same way its own
// edgePadding fix already does: it's the only annotation carrying this
// axis's shift property at all. "x2" is the correlation heatmap's second
// panel (the "distinguish" split) — always a native title too, so it never
// needs the annotation fallback below, but shares this rather than getting
// its own copy.
function getCurrentAxisLabel(plot: ExtendedPlotType, axis: "x" | "y" | "x2") {
  const axisKey = { x: "xaxis", y: "yaxis", x2: "xaxis2" }[axis];
  const axisLayout = ((plot.layout as unknown) as Record<string, unknown>)[
    axisKey
  ] as { title?: { text?: string } } | undefined;

  if (typeof axisLayout?.title?.text === "string") {
    return axisLayout.title.text;
  }

  if (axis === "x2") {
    return "";
  }

  const shiftKey = axis === "x" ? "yshift" : "xshift";

  const annotation = (
    (plot.layout.annotations as Record<string, unknown>[] | undefined) ?? []
  ).find((a) => shiftKey in a);

  return typeof annotation?.text === "string" ? annotation.text : "";
}

// Plotly's own text takes `<br>` for a line break, not a real newline — but
// the whole point of editing in a textarea is to let someone press Enter,
// not type out a tag. The stored label (state, and whatever Plotly itself
// hands back from getCurrentAxisLabel) always stays in this `<br>` form;
// these two only ever run at the textarea's own boundary, converting in
// when a prompt opens and back out when it resolves.
const brToNewline = (text: string) => text.replace(/<br\s*\/?>/gi, "\n");
const newlineToBr = (text: string) => text.replace(/\n/g, "<br>");

// A plain textarea rather than a single-line input: promptForValue's whole
// reason for existing here (over a text input in the side panel) is to
// give a long axis label more room to type and see itself wrap.
function EditAxisLabelPrompt({
  value,
  onChange,
}: PromptComponentProps<string>) {
  const ref = useRef<HTMLTextAreaElement>(null);

  // A ref-driven focus rather than the `autoFocus` prop, which triggers
  // jsx-a11y/no-autofocus — same effect (this modal exists only so someone
  // can immediately start typing), without the lint rule aimed at
  // unexpected focus jumps on page load.
  useEffect(() => {
    ref.current?.focus();
  }, []);

  return (
    <textarea
      ref={ref}
      className={styles.axisLabelTextarea}
      rows={3}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

// The value promptForValue holds for the legend editor: title plus one
// name per item, colors carried along only so the prompt can show a
// swatch next to each — never edited, never sent back out.
interface LegendEditValue {
  title: string;
  items: { name: string; hexColor: string }[];
}

function EditLegendPrompt({
  value,
  onChange,
}: PromptComponentProps<LegendEditValue>) {
  const ref = useRef<HTMLTextAreaElement>(null);

  // See EditAxisLabelPrompt's identical note on why this is a ref-driven
  // focus rather than the `autoFocus` prop.
  useEffect(() => {
    ref.current?.focus();
  }, []);

  return (
    <div className={styles.editLegend}>
      <label htmlFor="edit-legend-title">Legend title</label>
      <textarea
        ref={ref}
        id="edit-legend-title"
        className={styles.axisLabelTextarea}
        rows={2}
        value={value.title}
        onChange={(e) => onChange({ ...value, title: e.target.value })}
      />
      <label>Legend items</label>
      <div className={styles.editLegendItems}>
        {value.items.map((item, i) => (
          // Index, not name: this list's own order is what's stable while
          // the prompt is open (nothing here reorders), and two items can
          // share a name mid-edit.
          // eslint-disable-next-line react/no-array-index-key
          <div key={i} className={styles.editLegendItemRow}>
            <span
              className={styles.editLegendSwatch}
              style={{ backgroundColor: item.hexColor }}
            />
            <input
              type="text"
              value={item.name}
              onChange={(e) => {
                const items = [...value.items];
                items[i] = { ...items[i], name: e.target.value };
                onChange({ ...value, items });
              }}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

function ExportImageModal({
  plot,
  filename,
  onHide,
  previewPlot = undefined,
  plotType,
  Plotly: plotly,
}: Props & { Plotly: PlotlyType }) {
  const { plotStyles: savedPlotStyles } = useDataExplorerSettings();

  // Read once, on open: whatever the last export used for this plot type,
  // or the slide-oriented defaults the first time round.
  const [remembered] = useState(() => readRememberedExportConfig(plotType));

  // Two distinct things, which were briefly conflated: what the modal opens
  // with (the last export's values) and what "Restore export defaults"
  // restores (the shipped, slide-oriented ones). Both take the user's own
  // colors.
  //
  // Colors can't diverge from the saved palette yet, and the reason is the
  // same one that keeps the palette controls hidden: the color *assignment*
  // (colorMap, and the legend stand-in traces built from it) is computed a
  // layer above the renderer from the saved palette. Handing the renderer a
  // different palette here would leave the points and the legend disagreeing
  // — worse than either palette on its own. It's also why the palette isn't
  // among the fields we remember.
  const openingStyles = useMemo(
    () => ({ ...remembered.plotStyles, palette: savedPlotStyles.palette }),
    [remembered.plotStyles, savedPlotStyles.palette]
  );

  const defaultStyles = useMemo(
    () => ({
      ...DEFAULT_EXPORT_CONFIG.plotStyles,
      palette: savedPlotStyles.palette,
    }),
    [savedPlotStyles.palette]
  );

  // Always pixels. `unit` and `resolution` below only change how these are
  // shown and typed, never what gets exported.
  const [width, setWidth] = useState(remembered.width);
  const [height, setHeight] = useState(remembered.height);

  const [unit, setUnit] = useState<DimensionUnit>(remembered.unit);
  const [resolution, setResolution] = useState(remembered.resolution);
  const [format, setFormat] = useState<ExportImageFormat>(remembered.format);
  const [legendPosition, setLegendPosition] = useState<ExportLegendPosition>(
    remembered.legendPosition
  );
  const [edgePadding, setEdgePadding] = useState(remembered.edgePadding);
  const [chromeLineWidth, setChromeLineWidth] = useState(
    remembered.chromeLineWidth
  );
  const [dataLineWidth, setDataLineWidth] = useState(remembered.dataLineWidth);
  const [violinLineWidth, setViolinLineWidth] = useState(
    remembered.violinLineWidth
  );
  const [tickFontSize, setTickFontSize] = useState(remembered.tickFontSize);
  // Edits live here and nowhere else. The saved settings are never written,
  // which is the whole of "these changes affect only this image": this modal
  // simply has no path to localStorage.
  const [draftStyles, setDraftStyles] = useState<PlotStyles>(openingStyles);

  // Unlike every other field on this page, deliberately not part of
  // ExportConfig/rememberedConfig at all — not even in-memory-only like
  // draftStyles is, which still seeds itself from the last export. This
  // starts fresh from whatever the plot's real label currently is, every
  // time the modal opens, and there is nowhere for an edit to persist to
  // once it closes.
  const [xAxisLabel, setXAxisLabel] = useState(() =>
    getCurrentAxisLabel(plot, "x")
  );
  const [yAxisLabel, setYAxisLabel] = useState(() =>
    getCurrentAxisLabel(plot, "y")
  );
  // The correlation heatmap's second panel (the "distinguish" split) —
  // unlike xAxisLabel/yAxisLabel, there's no hideXAxis-style side effect
  // tied to this one, so it doesn't need an "original" snapshot to compare
  // against; it's simply always passed through.
  const [secondaryXAxisLabel, setSecondaryXAxisLabel] = useState(() =>
    getCurrentAxisLabel(plot, "x2")
  );

  // The same starting snapshot, kept around so buildFigure can tell "still
  // whatever it opened with" apart from "someone actually typed something
  // different" — see its own comment on why that distinction matters and
  // isn't just `xAxisLabel !== undefined`.
  const [originalXAxisLabel] = useState(() => getCurrentAxisLabel(plot, "x"));
  const [originalYAxisLabel] = useState(() => getCurrentAxisLabel(plot, "y"));

  // Same "transient, not even remembered" treatment as the axis labels
  // above, and for the same reason: there's nowhere for this to persist to
  // once the modal closes, by design. `legendItemLabels` starts as a plain
  // copy of each item's own name — undefined would also work as "no
  // override" (see applyLegendLabelOverrides), but seeding real strings is
  // what lets the editor show today's names as the starting point to edit,
  // rather than opening blank.
  const [legendTitle, setLegendTitle] = useState(
    () => previewPlot?.legend?.title ?? ""
  );
  const [legendItemLabels, setLegendItemLabels] = useState(() =>
    (previewPlot?.legend?.items ?? []).map((item) => item.name)
  );

  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [isRendering, setIsRendering] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [
    previewPlotElement,
    setPreviewPlotElement,
  ] = useState<ExtendedPlotType | null>(null);

  // Read once, on open. The preview is a second instance of the plot, and its
  // zoom, label positions and so on would otherwise start from scratch. Taking
  // the snapshot once (rather than per render) is what guarantees that editing
  // a style or a dimension cannot disturb the view being previewed.
  const transient = useMemo(() => captureTransientState(plot), [plot]);

  const canEditStyles = Boolean(previewPlot);

  // Without a preview instance to draw at the edited styles, the only figure
  // available is the live plot's own.
  const figureSource = canEditStyles ? previewPlotElement : plot;

  // Both the preview and the save go through this. They previously each called
  // getImageFigure directly, and an option passed to one but not the other
  // would quietly break the invariant this whole modal rests on: that the
  // preview IS the file.
  //
  // xAxisLabel/yAxisLabel are included only when they differ from the
  // snapshot the modal opened with — unlike every other option here,
  // `getImageFigure` gives these two a second meaning beyond "what text to
  // show": a renderer that hides its axis by default because the *default*
  // text would be misleading (waterfall, once faceted — see
  // PrototypeScatterPlot's own comment) treats a genuine override as
  // permission to show that axis again. `xAxisLabel` and `yAxisLabel` are
  // state seeded from that same default and never re-seeded, so passing
  // them unconditionally would make every export look "customized" even
  // when nobody touched the field.
  const buildFigure = () =>
    figureSource?.getImageFigure({
      legendPosition,
      edgePadding,
      chromeLineWidth,
      dataLineWidth,
      violinLineWidth,
      ...(xAxisLabel !== originalXAxisLabel ? { xAxisLabel } : {}),
      ...(yAxisLabel !== originalYAxisLabel ? { yAxisLabel } : {}),
      // No hideXAxis-style side effect on the correlation heatmap's second
      // panel — always passed through, like legendTitle below.
      secondaryXAxisLabel,
      legendTitle,
      legendItemLabels,
    }) ?? null;

  // Both the preview and the save go through this too, for the same reason:
  // the "outer" half of edgePadding is added as a border on top of what
  // Plotly rendered, not by Plotly itself, and the two can't be allowed to
  // diverge on that either. Renders at the true size minus the padding,
  // then pads it back out — see padOuterEdge/padOuterEdgeSvg for why the
  // padding isn't just part of the figure already, and why each format
  // needs its own way of adding it back.
  const renderPaddedImage = async (figure: object) => {
    const backgroundColor =
      ((figure as { layout?: { paper_bgcolor?: string } }).layout
        ?.paper_bgcolor as string) ?? "#fff";

    const rawUrl = await plotly.toImage(
      figure as Parameters<typeof plotly.toImage>[0],
      {
        format,
        width: Math.max(1, width - edgePadding),
        height: Math.max(1, height - edgePadding),
      }
    );

    return format === "svg"
      ? padOuterEdgeSvg(rawUrl, width, height, edgePadding, backgroundColor)
      : padOuterEdge(rawUrl, width, height, edgePadding, backgroundColor);
  };

  const areDimensionsValid =
    isValidNumber(width, MIN_DIMENSION, MAX_DIMENSION) &&
    isValidNumber(height, MIN_DIMENSION, MAX_DIMENSION) &&
    // A nonsense resolution doesn't corrupt the pixel dimensions, but it does
    // make every physical figure on screen meaningless, so don't let an image
    // be saved from numbers the user can't currently read.
    isValidResolution(resolution);

  const isEdgePaddingValid = isValidNumber(
    edgePadding,
    EDGE_PADDING_BOUNDS.min,
    EDGE_PADDING_BOUNDS.max
  );

  const isChromeLineWidthValid = isValidNumber(
    chromeLineWidth,
    CHROME_LINE_WIDTH_BOUNDS.min,
    CHROME_LINE_WIDTH_BOUNDS.max
  );

  const isDataLineWidthValid = isValidNumber(
    dataLineWidth,
    DATA_LINE_WIDTH_BOUNDS.min,
    DATA_LINE_WIDTH_BOUNDS.max
  );

  const isViolinLineWidthValid = isValidNumber(
    violinLineWidth,
    VIOLIN_LINE_WIDTH_BOUNDS.min,
    VIOLIN_LINE_WIDTH_BOUNDS.max
  );

  const isTickFontSizeValid = isValidNumber(
    tickFontSize,
    TICK_FONT_SIZE_BOUNDS.min,
    TICK_FONT_SIZE_BOUNDS.max
  );

  // Which entry in the "Fit into" menu the current size corresponds to, if
  // any. Derived rather than stored, so typing a size that happens to match a
  // preset selects it, and nudging away from one falls back to "Custom" —
  // the menu can't claim a size that isn't in the fields.
  const activePresetIndex = EXPORT_PRESETS.findIndex(
    (preset) => preset.width === width && preset.height === height
  );

  // "Restore export defaults" means the whole configuration, not just the
  // styles: the image's own dimensions are part of those defaults now, and
  // leaving them at whatever the last export used made the button look broken.
  const handleRestoreDefaults = () => {
    setWidth(DEFAULT_EXPORT_CONFIG.width);
    setHeight(DEFAULT_EXPORT_CONFIG.height);
    setUnit(DEFAULT_EXPORT_CONFIG.unit);
    setResolution(DEFAULT_EXPORT_CONFIG.resolution);
    setFormat(DEFAULT_EXPORT_CONFIG.format);
    setLegendPosition(DEFAULT_EXPORT_CONFIG.legendPosition);
    setEdgePadding(DEFAULT_EXPORT_CONFIG.edgePadding);
    setChromeLineWidth(DEFAULT_EXPORT_CONFIG.chromeLineWidth);
    setDataLineWidth(DEFAULT_EXPORT_CONFIG.dataLineWidth);
    setViolinLineWidth(DEFAULT_EXPORT_CONFIG.violinLineWidth);
    setTickFontSize(DEFAULT_EXPORT_CONFIG.tickFontSize);
    setDraftStyles(defaultStyles);
    // Not part of DEFAULT_EXPORT_CONFIG (nothing is, for these two — see
    // where they're declared) — "restore" for a label means undo the edit,
    // back to whatever the plot's real label actually is.
    setXAxisLabel(getCurrentAxisLabel(plot, "x"));
    setYAxisLabel(getCurrentAxisLabel(plot, "y"));
    setSecondaryXAxisLabel(getCurrentAxisLabel(plot, "x2"));
    setLegendTitle(previewPlot?.legend?.title ?? "");
    setLegendItemLabels(
      (previewPlot?.legend?.items ?? []).map((item) => item.name)
    );
  };

  const handleEditAxisLabel = async (
    axis: "x" | "y" | "x2",
    currentLabel: string,
    setLabel: (next: string) => void
  ) => {
    const next = await promptForValue<string>({
      title:
        axis === "x2"
          ? "Edit second heatmap's x-axis label"
          : `Edit ${axis}-axis label`,
      defaultValue: brToNewline(currentLabel),
      acceptButtonText: "Save",
      PromptComponent: EditAxisLabelPrompt,
      secondaryAction: {
        buttonText: "Restore original text",
        // promptForValue always resolves `undefined` for a "handled"
        // secondary action (see its own source) — there's no path to hand
        // a value back through the normal resolution flow, so this applies
        // the reset directly and closes, the same way the outer "Restore
        // export defaults" button applies immediately rather than previewing
        // first.
        onClick: async () => {
          setLabel(getCurrentAxisLabel(plot, axis));
          return true;
        },
      },
    });

    if (next !== undefined) {
      setLabel(newlineToBr(next));
    }
  };

  const handleEditLegend = async () => {
    const items = previewPlot?.legend?.items ?? [];

    const result = await promptForValue<LegendEditValue>({
      title: "Edit legend",
      defaultValue: {
        title: brToNewline(legendTitle),
        // Names come from current state (so a previous edit round-trips
        // back into the editor), colors always from the real thing — they
        // were never editable to begin with, only shown as a swatch.
        items: items.map((item, i) => ({
          name: legendItemLabels[i] ?? item.name,
          hexColor: item.hexColor,
        })),
      },
      acceptButtonText: "Save",
      PromptComponent: EditLegendPrompt,
      secondaryAction: {
        buttonText: "Restore original text",
        // See handleEditAxisLabel's identical note on why this applies and
        // closes rather than resetting the open prompt's own fields.
        onClick: async () => {
          setLegendTitle(previewPlot?.legend?.title ?? "");
          setLegendItemLabels(items.map((item) => item.name));
          return true;
        },
      },
    });

    if (result !== undefined) {
      setLegendTitle(newlineToBr(result.title));
      setLegendItemLabels(result.items.map((item) => item.name));
    }
  };

  const handleSelectPreset = (index: number) => {
    const preset = EXPORT_PRESETS[index];

    if (!preset) {
      return;
    }

    setWidth(preset.width);
    setHeight(preset.height);

    // A print preset is specified in inches at a resolution; showing it as a
    // pixel count would hide the very thing that makes it the right choice.
    if (preset.unit) {
      setUnit(preset.unit);
    }

    if (preset.dpi) {
      setResolution(preset.dpi);
    }
  };

  // Only the styles that are actually on offer. Judging the rest would mean
  // blocking an export over a value the user can't see, let alone fix — and
  // the point-size field this plot ignores is exactly such a value, as is
  // every point/annotation field when hasPointStyles is false (the
  // correlation heatmap) and yAxisFontSize when hasYAxisLabel is false.
  const hasPointStyles = previewPlot?.hasPointStyles ?? true;
  const hasYAxisLabel = previewPlot?.hasYAxisLabel ?? true;
  const editableStyleKeys = (Object.keys(
    PLOT_STYLE_BOUNDS
  ) as BoundedStyleKey[]).filter((key) => {
    if (key === "pointSize" || key === "facetedPointSize") {
      return hasPointStyles && key === previewPlot?.pointSizeField;
    }
    if (
      key === "pointOpacity" ||
      key === "outlineWidth" ||
      key === "annotationFontSize"
    ) {
      return hasPointStyles;
    }
    if (key === "yAxisFontSize") {
      return hasYAxisLabel;
    }
    return true;
  });

  const areStylesValid =
    !canEditStyles ||
    (editableStyleKeys.every((key) =>
      isValidNumber(
        draftStyles[key],
        PLOT_STYLE_BOUNDS[key].min,
        PLOT_STYLE_BOUNDS[key].max
      )
    ) &&
      // Points with neither fill nor outline would be invisible — a
      // meaningless constraint on a plot with no points to begin with.
      (!hasPointStyles ||
        draftStyles.pointOpacity > 0 ||
        draftStyles.outlineWidth > 0));

  const isValid =
    areDimensionsValid &&
    areStylesValid &&
    isEdgePaddingValid &&
    isChromeLineWidthValid &&
    isDataLineWidthValid &&
    isViolinLineWidthValid &&
    isTickFontSizeValid;

  const [zoomMode, setZoomMode] = useState<"fit" | "actual">("fit");
  const [isPanning, setIsPanning] = useState(false);
  const paneRef = useRef<HTMLDivElement>(null);
  // The pane's own size, needed to say what percentage "fit" is showing and to
  // know whether an actual-size image overflows (and so is worth panning).
  const [paneSize, setPaneSize] = useState({ width: 0, height: 0 });

  const measurePane = useCallback(() => {
    const pane = paneRef.current;

    if (pane) {
      setPaneSize({ width: pane.clientWidth, height: pane.clientHeight });
    }
  }, []);

  useLayoutEffect(() => {
    measurePane();
    window.addEventListener("resize", measurePane);

    // A single mount-time read is not enough: this lives inside a modal, whose
    // dialog may not be laid out yet when effects first run, and the pane also
    // changes size when the controls column grows or the window does. A stale
    // zero here used to silently disable panning altogether.
    let observer: ResizeObserver | undefined;

    // Absent in jsdom, so tests drive the window-resize path instead.
    if (typeof ResizeObserver !== "undefined" && paneRef.current) {
      observer = new ResizeObserver(measurePane);
      observer.observe(paneRef.current);
    }

    return () => {
      window.removeEventListener("resize", measurePane);
      observer?.disconnect();
    };
  }, [measurePane]);

  // Whatever is on screen has just changed shape, so the old measurement is
  // not about the current preview.
  useLayoutEffect(measurePane, [
    measurePane,
    zoomMode,
    width,
    height,
    dataUrl,
    canEditStyles,
    isValid,
  ]);

  const isMeasured = paneSize.width > 0 && paneSize.height > 0;

  // How much "fit to screen" is shrinking the output to get it into the pane.
  const fitScale = isMeasured
    ? Math.min(1, paneSize.width / width, paneSize.height / height)
    : 1;

  // Sized from the *requested* dimensions in both modes, never from the
  // rendered bitmap's own.
  let previewImageStyle: React.CSSProperties;

  if (zoomMode === "actual") {
    // One image pixel per CSS pixel, so what's on screen is literally what
    // lands in the file. Overflow is panned rather than scaled away.
    previewImageStyle = { width, height, maxWidth: "none", flex: "0 0 auto" };
  } else if (areDimensionsValid && isMeasured) {
    previewImageStyle = {
      width: Math.round(width * fitScale),
      height: Math.round(height * fitScale),
      flex: "0 0 auto",
      // Inert given the arithmetic above, but a cheap guard against ever
      // spilling out of a pane whose measurement went stale.
      maxWidth: "100%",
      maxHeight: "100%",
    };
  } else {
    // Nothing trustworthy to scale by yet (unmeasured pane, or a dimension
    // the user is still mid-edit), so just keep it inside the pane.
    previewImageStyle = { maxWidth: "100%", maxHeight: "100%" };
  }

  const canPan =
    zoomMode === "actual" &&
    Boolean(dataUrl) &&
    (!isMeasured || width > paneSize.width || height > paneSize.height);

  let panCursor: string | undefined;

  if (canPan) {
    panCursor = isPanning ? "grabbing" : "grab";
  }

  const panOrigin = useRef({ x: 0, y: 0, left: 0, top: 0 });

  const handleMouseDown = (e: React.MouseEvent) => {
    const pane = paneRef.current;

    // In fit mode there is nothing to pan (the pane doesn't even scroll), so
    // don't start a drag or begin listening for one.
    if (!pane || zoomMode !== "actual") {
      return;
    }

    // Otherwise the browser starts a text/image selection drag instead.
    e.preventDefault();

    panOrigin.current = {
      x: e.clientX,
      y: e.clientY,
      left: pane.scrollLeft,
      top: pane.scrollTop,
    };
    setIsPanning(true);
  };

  useEffect(() => {
    if (!isPanning) {
      return undefined;
    }

    // Tracked on the window, not the pane, so a drag that wanders outside the
    // pane keeps panning and still ends on release.
    const handleMouseMove = (e: MouseEvent) => {
      const pane = paneRef.current;

      if (pane) {
        pane.scrollLeft =
          panOrigin.current.left - (e.clientX - panOrigin.current.x);
        pane.scrollTop =
          panOrigin.current.top - (e.clientY - panOrigin.current.y);
      }
    };

    const stop = () => setIsPanning(false);

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", stop);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", stop);
    };
  }, [isPanning]);

  // Bumped per requested render so a slow rasterization resolving after a
  // newer one can't overwrite it with a stale image.
  const requestId = useRef(0);

  useEffect(() => {
    if (!isValid || !figureSource) {
      return undefined;
    }

    const id = requestId.current + 1;
    requestId.current = id;
    setIsRendering(true);

    const run = async () => {
      try {
        // Deliberately the same figure `downloadImage` saves, so the preview
        // can't drift from the file. It differs from what's on screen: our
        // legend is custom HTML and can't be rasterized, so the export carries
        // stand-in traces for it, and the reference lines are bounded.
        const figure = buildFigure();

        if (!figure) {
          throw new Error("The plot could not be prepared for export.");
        }

        const url = await renderPaddedImage(figure);

        if (requestId.current === id) {
          setDataUrl(url);
          setError(null);
          setIsRendering(false);
        }
      } catch (e) {
        window.console.error(e);

        if (requestId.current === id) {
          setError("Could not render a preview of this plot.");
          setIsRendering(false);
        }
      }
    };

    const timeout = window.setTimeout(run, dataUrl ? DEBOUNCE_MS : 0);

    return () => window.clearTimeout(timeout);
    // `dataUrl` is read only to decide whether to debounce (the first render
    // should be immediate) and must not itself trigger a re-render, or every
    // completed render would queue another one.
    //
    // `draftStyles` and `tickFontSize` are dependencies even though neither
    // is read here: the preview instance consumes them (tickFontSize as its
    // own prop, outside plotStyles — see RenderPreviewPlot), and this
    // effect's job is to rasterize whatever that instance has just drawn.
    // Child effects run before parent effects in the same commit and
    // Plotly.react is synchronous, so by the time this runs the preview's
    // figure already reflects both. `legendPosition`, `edgePadding`,
    // `chromeLineWidth`, `dataLineWidth`, `violinLineWidth`, `xAxisLabel`,
    // `yAxisLabel`, `secondaryXAxisLabel`, `legendTitle` and
    // `legendItemLabels` likewise aren't read here — buildFigure closes
    // over all ten — but they change the figure, so the preview has to be
    // redrawn for any of them. `format` *is* read directly, by
    // renderPaddedImage.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    figureSource,
    plotly,
    width,
    height,
    draftStyles,
    tickFontSize,
    format,
    legendPosition,
    edgePadding,
    chromeLineWidth,
    dataLineWidth,
    violinLineWidth,
    xAxisLabel,
    yAxisLabel,
    secondaryXAxisLabel,
    legendTitle,
    legendItemLabels,
    isValid,
  ]);

  const handleClickSave = async () => {
    const figure = buildFigure();

    if (figure) {
      const config: ExportConfig = {
        width,
        height,
        unit,
        resolution,
        format,
        legendPosition,
        edgePadding,
        chromeLineWidth,
        dataLineWidth,
        violinLineWidth,
        tickFontSize,
        plotStyles: draftStyles,
      };

      rememberExportConfig(config, plotType);

      // Not plotly.downloadImage: that renders at exactly (width, height)
      // with no way to hand it the padded result, so saving goes through
      // the same renderPaddedImage the preview does and triggers the
      // download itself — the same invariant as buildFigure, just one step
      // later in the pipeline.
      const url = await renderPaddedImage(figure);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${filename}.${format}`;
      link.click();
      onHide();
    }
  };

  const dimensionInput = (
    label: string,
    value: number,
    onChange: (n: number) => void
  ) => (
    <div className={styles.dimension}>
      <label htmlFor={`export-${label}`}>{label}</label>
      <div className={styles.dimensionControls}>
        <input
          type="range"
          // The visible label belongs to the number input, which is the one
          // you'd use to type an exact value; naming both the same thing would
          // make the pair ambiguous to a screen reader.
          aria-label={`${label} slider`}
          min={MIN_DIMENSION}
          max={MAX_DIMENSION}
          step={SLIDER_STEP}
          // A range input has no way to show "empty" or an out-of-range
          // number, so while the number field holds one, park the slider at
          // the nearest end rather than handing React a NaN.
          value={clampForSlider(value)}
          onChange={(e) => onChange(e.target.valueAsNumber)}
        />
        <LengthInput
          id={`export-${label}`}
          valuePx={value}
          minPx={MIN_DIMENSION}
          maxPx={MAX_DIMENSION}
          unit={unit}
          resolution={resolution}
          pxStep={10}
          onChangePx={onChange}
        />
        <span>{UNIT_SUFFIX[unit]}</span>
      </div>
    </div>
  );

  return (
    <Modal
      show
      bsSize="large"
      backdrop="static"
      onHide={onHide}
      className={styles.exportImageModal}
    >
      <Modal.Header closeButton>
        <Modal.Title>Export image</Modal.Title>
      </Modal.Header>
      <Modal.Body className={styles.exportImageModalBody}>
        <div className={styles.controls}>
          <h4>Size</h4>
          <div className={styles.dimension}>
            <label htmlFor="export-format">file format</label>
            <select
              id="export-format"
              className={styles.select}
              value={format}
              onChange={(e) => setFormat(e.target.value as ExportImageFormat)}
            >
              <option value="png">PNG</option>
              <option value="svg">SVG</option>
            </select>
          </div>
          <div className={styles.dimension}>
            <label htmlFor="export-preset">fit into</label>
            <select
              id="export-preset"
              className={styles.select}
              value={activePresetIndex}
              onChange={(e) => handleSelectPreset(Number(e.target.value))}
            >
              {/* Only offered when it's what the fields actually say; there's
                  nothing for choosing "Custom" to do. */}
              {activePresetIndex === -1 && <option value={-1}>Custom</option>}
              {EXPORT_PRESETS.map((preset, index) => (
                <option key={preset.label} value={index}>
                  {preset.label}
                </option>
              ))}
            </select>
          </div>
          {dimensionInput("width", width, setWidth)}
          {dimensionInput("height", height, setHeight)}
          <div className={styles.dimension}>
            <label htmlFor="export-unit">units</label>
            <select
              id="export-unit"
              className={styles.select}
              value={unit}
              onChange={(e) => setUnit(e.target.value as DimensionUnit)}
            >
              {UNIT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          {unit !== "px" && (
            <div className={styles.dimension}>
              <label htmlFor="export-resolution">resolution</label>
              <div className={styles.dimensionControls}>
                <input
                  id="export-resolution"
                  type="number"
                  min={MIN_RESOLUTION}
                  max={MAX_RESOLUTION}
                  step={1}
                  value={Number.isNaN(resolution) ? "" : resolution}
                  onChange={(e) => setResolution(e.target.valueAsNumber)}
                />
                <span>px/in</span>
              </div>
              <p className={styles.hint}>
                Changes how the size above is described, not what gets exported
                {Number.isFinite(width) && Number.isFinite(height)
                  ? ` — that stays ${width} × ${height} px.`
                  : "."}
              </p>
            </div>
          )}
          <p className={styles.note}>
            Text and point sizes don’t scale with these dimensions, so a larger
            image has proportionally smaller labels.
          </p>
          {Boolean(previewPlot?.legend) && (
            <div className={styles.dimension}>
              <label htmlFor="export-legend">legend placement</label>
              <select
                id="export-legend"
                className={styles.select}
                value={legendPosition}
                onChange={(e) =>
                  setLegendPosition(e.target.value as ExportLegendPosition)
                }
              >
                <option value="right">Right of plot</option>
                <option value="above">Above plot</option>
                <option value="hidden">Hidden</option>
              </select>
              {legendPosition === "above" && (
                <p className={styles.hint}>
                  Spends height instead of width, and wraps to more rows rather
                  than clipping — better when there are many categories.
                </p>
              )}
            </div>
          )}
          <div className={styles.dimension}>
            <label htmlFor="export-edge-padding">extra margin</label>
            <div className={styles.dimensionControls}>
              <input
                id="export-edge-padding"
                type="number"
                min={EDGE_PADDING_BOUNDS.min}
                max={EDGE_PADDING_BOUNDS.max}
                step={1}
                value={Number.isNaN(edgePadding) ? "" : edgePadding}
                onChange={(e) => setEdgePadding(e.target.valueAsNumber)}
              />
              <span>px</span>
            </div>
            <p className={styles.hint}>
              Added on top of the space already reserved for axis labels. Raise
              this if text still looks tight against the edge or its own tick
              marks, especially at a large axis font size.
            </p>
          </div>
          <div className={styles.dimension}>
            <label htmlFor="export-chrome-line-width">grid lines</label>
            <div className={styles.dimensionControls}>
              <input
                id="export-chrome-line-width"
                type="number"
                min={CHROME_LINE_WIDTH_BOUNDS.min}
                max={CHROME_LINE_WIDTH_BOUNDS.max}
                step={1}
                value={Number.isNaN(chromeLineWidth) ? "" : chromeLineWidth}
                onChange={(e) => setChromeLineWidth(e.target.valueAsNumber)}
              />
              <span>px</span>
            </div>
            <p className={styles.hint}>
              Gridlines — thin by default like the plot on screen. Raise this
              for legibility at slide scale, or set to 0 to hide them.
            </p>
          </div>
          {(previewPlot?.hasDataLines ?? true) && (
            <div className={styles.dimension}>
              <label htmlFor="export-data-line-width">
                y=x &amp; regression lines
              </label>
              <div className={styles.dimensionControls}>
                <input
                  id="export-data-line-width"
                  type="number"
                  min={DATA_LINE_WIDTH_BOUNDS.min}
                  max={DATA_LINE_WIDTH_BOUNDS.max}
                  step={1}
                  value={Number.isNaN(dataLineWidth) ? "" : dataLineWidth}
                  onChange={(e) => setDataLineWidth(e.target.valueAsNumber)}
                />
                <span>px</span>
              </div>
              <p className={styles.hint}>
                The identity line and any regression lines. Their white outline
                stays 2px wider than this at any setting.
              </p>
            </div>
          )}
          {previewPlot?.hasViolinLines && (
            <div className={styles.dimension}>
              <label htmlFor="export-violin-line-width">violin outline</label>
              <div className={styles.dimensionControls}>
                <input
                  id="export-violin-line-width"
                  type="number"
                  min={VIOLIN_LINE_WIDTH_BOUNDS.min}
                  max={VIOLIN_LINE_WIDTH_BOUNDS.max}
                  step={1}
                  value={Number.isNaN(violinLineWidth) ? "" : violinLineWidth}
                  onChange={(e) => setViolinLineWidth(e.target.valueAsNumber)}
                />
                <span>px</span>
              </div>
              <p className={styles.hint}>
                The violin&apos;s curve. Its white contrast outline stays 2px
                wider than this at any setting.
              </p>
            </div>
          )}
          {previewPlot?.hasTickFontSize && (
            <div className={styles.dimension}>
              <label htmlFor="export-tick-font-size">tick font size</label>
              <div className={styles.dimensionControls}>
                <input
                  id="export-tick-font-size"
                  type="number"
                  min={TICK_FONT_SIZE_BOUNDS.min}
                  max={TICK_FONT_SIZE_BOUNDS.max}
                  step={1}
                  value={Number.isNaN(tickFontSize) ? "" : tickFontSize}
                  onChange={(e) => setTickFontSize(e.target.valueAsNumber)}
                />
                <span>px</span>
              </div>
              <p className={styles.hint}>
                Row/column labels and the colorbar&apos;s own ticks. A dense
                heatmap may need this smaller to keep every label — or a larger,
                more legible size may be worth Plotly skipping some. That
                tradeoff is yours to strike.
              </p>
            </div>
          )}
          {unit !== "px" && (
            <p className={styles.note}>
              The file records no resolution of its own, so a document will
              place it at its own default — set the physical size again there.
            </p>
          )}
          {canEditStyles && (
            <>
              <h4>Labels</h4>
              <p className={styles.note}>
                Overrides the text shown on the image only — never saved, and
                gone once this modal closes.
              </p>
              <div className={styles.dimension}>
                <label htmlFor="export-x-axis-label">x-axis label</label>
                <Button
                  id="export-x-axis-label"
                  className={styles.axisLabelButton}
                  onClick={() =>
                    handleEditAxisLabel("x", xAxisLabel, setXAxisLabel)
                  }
                >
                  {xAxisLabel || "(empty)"}
                </Button>
              </div>
              {(previewPlot?.hasYAxisLabel ?? true) && (
                <div className={styles.dimension}>
                  <label htmlFor="export-y-axis-label">y-axis label</label>
                  <Button
                    id="export-y-axis-label"
                    className={styles.axisLabelButton}
                    onClick={() =>
                      handleEditAxisLabel("y", yAxisLabel, setYAxisLabel)
                    }
                  >
                    {yAxisLabel || "(empty)"}
                  </Button>
                </div>
              )}
              {previewPlot?.hasSecondaryXAxisLabel && (
                <div className={styles.dimension}>
                  <label htmlFor="export-secondary-x-axis-label">
                    second heatmap&apos;s x-axis label
                  </label>
                  <Button
                    id="export-secondary-x-axis-label"
                    className={styles.axisLabelButton}
                    onClick={() =>
                      handleEditAxisLabel(
                        "x2",
                        secondaryXAxisLabel,
                        setSecondaryXAxisLabel
                      )
                    }
                  >
                    {secondaryXAxisLabel || "(empty)"}
                  </Button>
                </div>
              )}
              {previewPlot?.legend && legendPosition !== "hidden" && (
                <div className={styles.dimension}>
                  <label htmlFor="export-legend-edit">legend</label>
                  <Button
                    id="export-legend-edit"
                    className={styles.axisLabelButton}
                    onClick={handleEditLegend}
                  >
                    {legendTitle || "(empty)"}
                  </Button>
                </div>
              )}
              <h4>Styles</h4>
              <p className={styles.note}>
                Sized for dropping into a slide, not to match the plot on
                screen. Changes here apply to this image only and never touch
                your saved settings. Colors do follow your saved settings — use
                the gear icon to change them.
              </p>
              <PlotStyleFields
                plotStyles={draftStyles}
                defaultPlotStyles={defaultStyles}
                onChange={(update) => setDraftStyles(update)}
                resetButtonText="Restore export defaults"
                onClickReset={handleRestoreDefaults}
                // See the prop's own comment: a palette edit here would reach
                // the renderer but not the color assignment computed above it,
                // so it would apply to some traces and silently miss the
                // categorical ones.
                showPaletteFields={false}
                // No points/annotations on the correlation heatmap — every
                // one of these fields would be a dead control there.
                showPointFields={hasPointStyles}
                // No Y-axis title to size on the correlation heatmap either.
                showYAxisFontSize={hasYAxisLabel}
                // So the whole dialog speaks one language: picking inches for
                // the canvas shouldn't leave type sizes in pixels.
                lengthUnit={unit}
                resolution={resolution}
                // Only the field this plot actually uses; the other one would
                // sit there doing nothing.
                pointSizeField={previewPlot!.pointSizeField}
              />
            </>
          )}
          {!isValid && (
            <p className={styles.invalid}>
              Some values are out of range, so the preview below is out of date.
            </p>
          )}
        </div>
        <div className={styles.previewPane}>
          <div className={styles.zoomControls}>
            <ButtonGroup bsSize="xsmall">
              <Button
                active={zoomMode === "fit"}
                onClick={() => setZoomMode("fit")}
              >
                Fit to screen
              </Button>
              <Button
                active={zoomMode === "actual"}
                onClick={() => setZoomMode("actual")}
              >
                Actual size
              </Button>
            </ButtonGroup>
            {canPan && <span className={styles.panHint}>drag to pan</span>}
          </div>
          {/*
            A scrolling region, which the jsx-a11y rules have no role for: they
            see a non-interactive element and object to both the listener and
            the tabIndex. The tabIndex is the accessible choice rather than a
            violation — a scrollable region that can't be focused can't be
            reached by keyboard at all (axe's own scrollable-region-focusable
            rule requires exactly this). Once focused, the arrow keys scroll it
            natively, and the drag-to-pan below is a convenience on top.
          */}
          {/* eslint-disable jsx-a11y/no-noninteractive-element-interactions, jsx-a11y/no-noninteractive-tabindex */}
          <div
            ref={paneRef}
            className={styles.preview}
            style={{
              overflow: zoomMode === "actual" ? "auto" : "hidden",
              cursor: panCursor,
            }}
            onMouseDown={handleMouseDown}
            role="group"
            aria-label="Export preview"
            tabIndex={0}
          >
            {error && <p className={styles.error}>{error}</p>}
            {!error && dataUrl && (
              <img
                src={dataUrl}
                alt="The plot as it will be exported"
                draggable={false}
                onLoad={measurePane}
                style={previewImageStyle}
              />
            )}
            {isRendering && (
              <div className={styles.spinner}>
                <span className="glyphicon glyphicon-refresh" /> rendering…
              </div>
            )}
          </div>
          {/* eslint-enable jsx-a11y/no-noninteractive-element-interactions, jsx-a11y/no-noninteractive-tabindex */}
        </div>
      </Modal.Body>
      <Modal.Footer>
        <Button onClick={onHide}>Cancel</Button>
        <Button
          bsStyle="primary"
          disabled={!isValid || !dataUrl || isRendering}
          onClick={handleClickSave}
        >
          Save image
        </Button>
      </Modal.Footer>
      {/*
        The second instance of the plot, drawn at the edited styles so that
        `getImageFigure` can be read off it. Positioned off screen rather than
        hidden with `display: none`: it must keep real dimensions, because the
        renderers observe their node with a ResizeObserver and hand it to
        Plotly.Plots.resize, which misbehaves on a zero-sized box.
      */}
      {previewPlot && (
        <div className={styles.offscreen} aria-hidden>
          {previewPlot.render({
            plotStyles: draftStyles,
            onLoad: setPreviewPlotElement,
            initialAxes: transient.axes,
            initialAnnotationTails: transient.annotationTails,
            tickFontSize,
          })}
        </div>
      )}
    </Modal>
  );
}

export default function LazyExportImageModal({
  previewPlot = undefined,
  ...props
}: Props) {
  const PlotlyLoader = usePlotlyLoader();

  return (
    <PlotlyLoader version="module">
      {(plotly) => (
        <ExportImageModal
          {...props}
          previewPlot={previewPlot}
          Plotly={plotly}
        />
      )}
    </PlotlyLoader>
  );
}
