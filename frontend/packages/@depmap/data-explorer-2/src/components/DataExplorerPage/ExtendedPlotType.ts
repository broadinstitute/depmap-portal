import type {
  PlotData,
  Layout,
  Config,
  DownloadImgopts,
  PlotlyHTMLElement,
} from "plotly.js";
import type {
  ExportLegendPosition,
  ImageFigure,
} from "./components/plot/prototype/plotUtils";

type ExtendedPlotType = HTMLDivElement &
  PlotlyHTMLElement & {
    data: PlotData[];
    layout: Layout;
    config: Config;
    // This is built into Plotly but not documented in its type definitions.
    // eslint-disable-next-line @typescript-eslint/ban-types
    removeListener: (eventName: string, callback: Function) => void;

    // custom extensions
    zoomIn: () => void;
    zoomOut: () => void;
    resetZoom: () => void;
    annotateSelected: (points?: number[]) => void;
    removeAnnotations: () => void;
    isPointInView: (pointIndex: number) => boolean;
    setDragmode: (dragmode: Layout["dragmode"]) => void;
    // The figure an image export renders, detached from this graph div. It is
    // NOT the figure on screen: it carries dummy traces standing in for our
    // custom HTML legend, and bounded (rather than apparently infinite)
    // reference lines. `downloadImage` is a thin wrapper over it, so anything
    // that wants to preview or otherwise handle the exported image itself can
    // render exactly what would be saved. Returns null when the figure can't
    // be built yet.
    // `legendPosition` is an export-time choice (see legendLayoutFor), not a
    // plot style, so it travels as an argument rather than a renderer prop.
    // Omitted, the legend keeps Plotly's default right-hand placement, which
    // is what every existing caller gets.
    // `edgePadding` is likewise export-only (see exportMarginFloor): extra
    // pixels of margin on top of whatever this instance already converged
    // to, for whichever case a heuristic couldn't get right on its own.
    // Omitted, it falls back to EXPORT_EDGE_PADDING.
    // `chromeLineWidth` (see calcChromeAxisOverrides), `dataLineWidth`
    // (see calcPlotIndicatorLineShapes), and `violinLineWidth` (see
    // calcViolinOutlineWidth, Density 1D only) are export-only too. Omitted,
    // they fall back to DEFAULT_CHROME_LINE_WIDTH / DEFAULT_DATA_LINE_WIDTH /
    // DEFAULT_VIOLIN_LINE_WIDTH, which reproduce today's appearance exactly.
    // `xAxisLabel`/`yAxisLabel` override the axis text shown in the image
    // only — transient UI state in ExportImageModal, never persisted.
    // Omitted, each renderer falls back to its own `xLabel`/`yLabel` prop.
    // `secondaryXAxisLabel` is the same idea for the correlation heatmap's
    // second panel (the "distinguish" split) — unused by every other
    // renderer, which has no such second axis.
    // `legendTitle`/`legendItemLabels` are the same idea for the legend
    // (see applyLegendLabelOverrides) — `legendItemLabels` is matched by
    // index against the renderer's own `legendForDownload.items`.
    getImageFigure: (options?: {
      legendPosition?: ExportLegendPosition;
      edgePadding?: number;
      chromeLineWidth?: number;
      dataLineWidth?: number;
      violinLineWidth?: number;
      xAxisLabel?: string;
      yAxisLabel?: string;
      secondaryXAxisLabel?: string;
      legendTitle?: string;
      legendItemLabels?: string[];
    }) => ImageFigure | null;
    downloadImage: (options: DownloadImgopts) => void;
    xValueMissing: (pointIndex: number) => boolean;
    yValueMissing: (pointIndex: number) => boolean;
  };

export default ExtendedPlotType;
