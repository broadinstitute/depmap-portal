import type {
  PlotData,
  Layout,
  Config,
  DownloadImgopts,
  PlotlyHTMLElement,
} from "plotly.js";

type ExtendedPlotType = HTMLDivElement &
  PlotlyHTMLElement & {
    data: PlotData[];
    layout: Layout;
    config: Config;
    // This is built into Plotly but not documented in its type definitions.
    removeListener: (eventName: string, callback: Function) => void;

    // custom extensions
    zoomIn: () => void;
    zoomOut: () => void;
    resetZoom: () => void;
    annotateSelected: () => void;
    removeAnnotations: () => void;
    isPointInView: (pointIndex: number) => boolean;
    setDragmode: (dragmode: Layout["dragmode"]) => void;
    downloadImage: (options: DownloadImgopts) => void;
    xValueMissing: (pointIndex: number) => boolean;
    yValueMissing: (pointIndex: number) => boolean;
  };

export default ExtendedPlotType;
