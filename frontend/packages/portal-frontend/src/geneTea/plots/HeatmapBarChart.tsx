import React, {
  useEffect,
  useCallback,
  useMemo,
  useRef,
  useState,
} from "react";
import type {
  Data as PlotlyData,
  Layout,
  PlotlyHTMLElement,
  ColorScale,
  Datum,
} from "plotly.js";
import PlotlyLoader, { PlotlyType } from "src/plot/components/PlotlyLoader";
import customizeDragLayer from "src/doseViabilityPrototype/components/PrototypeBrushableHeatmap/customizeDragLayer";
import {
  BarChartFormattedData,
  HeatmapFormattedData,
} from "@depmap/types/src/experimental_genetea";
import ExtendedPlotType from "src/plot/models/ExtendedPlotType";
import { getLayout } from "./layouts";
import { generateTickLabels } from "../utils";
import styles from "./HeatmapBarChart.scss";
import debounce from "lodash.debounce";
import usePlotResizer from "src/compound/heatmapTab/doseViabilityHeatmap/hooks/usePlotResizer";

const greenScale = [
  [0, "rgb(232, 232, 232)"],
  [1, "rgb(0, 110, 87)"],
];
interface Props {
  plotTitle: string;
  heatmapXAxisTitle: string;
  heatmapData: HeatmapFormattedData;
  barChartXAxisTitle: string;
  barChartData: BarChartFormattedData;
  legendTitle: string;
  selectedColumns: Set<number>;
  onSelectColumnRange: (start: number, end: number, shiftKey: boolean) => void;
  onClearSelection: () => void;
  onLoad: (plot: ExtendedPlotType) => void;
  doGroupTerms: boolean;
  hovertemplate?: string | string[];
  // Optionally set a min/max for the color scale. If left undefined, these
  // will default to the min and max of values contained in `data.z`
  zmin?: number;
  zmax?: number;
}

function HeatmapBarChart({
  doGroupTerms,
  plotTitle,
  heatmapXAxisTitle,
  heatmapData,
  barChartXAxisTitle,
  barChartData,
  legendTitle,
  selectedColumns,
  onSelectColumnRange,
  onClearSelection,
  onLoad,
  hovertemplate = undefined,
  zmin = undefined,
  zmax = undefined,
  Plotly,
}: Props & { Plotly: PlotlyType }) {
  const ref = useRef<ExtendedPlotType>(null);
  usePlotResizer(Plotly, ref);

  const updateLayoutOnScreenSizeChange = useCallback(
    (plot: ExtendedPlotType) => {
      if (plot && plot.layout) {
        Plotly.relayout(plot, {
          ...plot.layout,
          grid:
            window.innerWidth < 1250
              ? { rows: 2, columns: 1, pattern: "independent" }
              : { rows: 1, columns: 2, pattern: "independent" },
          xaxis: {
            ...plot.layout.xaxis,
            domain: window.innerWidth < 1250 ? [0, 1] : [0, 0.7],
          },
          xaxis2: {
            ...plot.layout.xaxis2,
            domain: window.innerWidth < 1250 ? [0, 1] : [0.73, 1],
          },
          yaxis2: {
            ...plot.layout.yaxis2,
            visible: window.innerWidth < 1250,
          },
        });
      }
    },
    [Plotly]
  );

  useEffect(() => {
    if (onLoad && ref.current) {
      onLoad(ref.current);
    }
  }, [onLoad]);

  const initialRange: [number, number] = useMemo(() => {
    return [0, heatmapData.x.length - 1];
  }, [heatmapData]);

  const [selectedRange, setSelectedRange] = useState(initialRange);
  const [hoveredColumns, setHoveredColumns] = useState<number[]>([]);

  const [
    showFullXAxisTickLabels,
    setShowFullAxisTickLabels,
  ] = useState<boolean>(false);

  const getShowXAxisTickLabels = useCallback(() => {
    if (ref.current) {
      const dataToPiixels = (ref.current as any)._fullLayout.xaxis.l2p;

      const pixelWidth = dataToPiixels(1) - dataToPiixels(0);

      return pixelWidth > 20;
    }

    return false;
    // eslint-disable-next-line
  }, [selectedRange, selectedColumns]);

  const xAxisTickLabels = useMemo(() => {
    const showTickLabels = getShowXAxisTickLabels();
    setShowFullAxisTickLabels(showTickLabels);
    return generateTickLabels(
      heatmapData.x.map(String),
      selectedColumns,
      showFullXAxisTickLabels
    );
  }, [
    heatmapData.x,
    selectedColumns,
    getShowXAxisTickLabels,
    showFullXAxisTickLabels,
  ]);

  useEffect(() => {
    const plot = ref.current as ExtendedPlotType;
    let range: [number, number] = [
      0 - 0.5,
      [...new Set(heatmapData.x)].length - 0.5,
    ];
    if (
      plot &&
      plot.layout &&
      plot.layout.xaxis &&
      Array.isArray(plot.layout.xaxis.range) &&
      plot.layout.xaxis.range.length === 2
    ) {
      range = plot.layout.xaxis.range as [number, number];
    }

    const plotlyHeatmapData: PlotlyData = {
      type: "heatmap",
      ...heatmapData,
      colorscale: greenScale as ColorScale,
      zmin,
      zmax,
      xaxis: "x",
      yaxis: "y",
      hovertemplate,
      xgap: 0.35,
      ygap: 0.35,

      colorbar: {
        x: -0.25,
        y: -0.45,
        len: 0.25,
        thickness: 10,
        ypad: 0,
        xanchor: "left",
        // These features are undocumented and won't type check properly.
        ...({
          orientation: "h",
          title: {
            text: "Fraction Mapping",
            side: "bottom",
          },
        } as object),
      },
    };

    const plotlyBarChartData: PlotlyData = {
      ...barChartData,
      type: "bar",
      xaxis: "x2",
      yaxis: "y2",
      hovertemplate,
      orientation: "h",
      marker: {
        color: doGroupTerms
          ? barChartData.x.map((_, i) => (i % 2 === 0 ? "#bdbdbd" : "#777b7e"))
          : "#777b7e",

        line: {
          width: 0.2, // Set the line width for the divider
        },
      },
    };

    const layout: Partial<Layout> = getLayout(
      heatmapData,
      heatmapXAxisTitle,
      barChartXAxisTitle,
      xAxisTickLabels,
      new Set(hoveredColumns),
      selectedColumns,
      range,
      window.innerWidth < 1220
    );

    Plotly.react(plot, [plotlyHeatmapData, plotlyBarChartData], layout);

    // Keep track of added listeners so we can easily remove them.
    const listeners: [string, (e: object) => void][] = [];

    const on = (eventName: string, callback: (e: object) => void) => {
      plot.on(
        eventName as Parameters<PlotlyHTMLElement["on"]>[0],
        callback as Parameters<PlotlyHTMLElement["on"]>[1]
      );
      listeners.push([eventName, callback]);
    };

    const getButton = (attr: string, val: string) =>
      plot.querySelector(
        `.modebar-btn[data-attr="${attr}"][data-val="${val}"]`
      ) as HTMLAnchorElement;

    const zoom = (val: "in" | "out" | "reset") => {
      getButton("zoom", val).click();
      const showTickLabels = getShowXAxisTickLabels();
      setShowFullAxisTickLabels(showTickLabels);
      // This redraw fixes a very strange bug where setting the drag mode to
      // select (or lasso) with a filter also applied causes all of the points
      // to disappear.
      Plotly.redraw(plot);
    };

    plot.zoomIn = () => setTimeout(zoom, 0, "in");
    plot.zoomOut = () => setTimeout(zoom, 0, "out");

    plot.resetZoom = () => {
      const nextLayout = { ...plot.layout };
      (plot.layout.shapes as any) = undefined;
      zoom("reset");
      Plotly.react(plot, plot.data, nextLayout, plot.config);
    };

    on("plotly_afterplot", () => {
      customizeDragLayer({
        plot,
        onMouseOut: () => setHoveredColumns([]),
        onChangeInProgressSelection: (start, end) => {
          const inProgressRange = [];
          for (let i = start; i <= end; i += 1) {
            inProgressRange.push(i);
          }
          setHoveredColumns(inProgressRange);
        },
        onSelectColumnRange: (start, end, shiftKey) => {
          onSelectColumnRange(start, end, shiftKey);
        },
        onClearSelection,
      });
    });

    on("plotly_hover", (e: any) => {
      setHoveredColumns([e.points[0].pointIndex[1]]);
    });

    // https://github.com/plotly/plotly.js/blob/55dda47/src/lib/prepare_regl.js
    on("plotly_webglcontextlost", () => {
      // Fixes a bug where points disappear after the browser has been left
      // idle for some time.
      Plotly.redraw(plot);
    });

    // Used for PlotControls.tsx to zoom to the highest resolution possible
    // the keeps all selected columns in the visible window.
    plot.zoomToSelection = (selections: Set<number>) => {
      if (!plot) return;

      if (selections.size > 0 && plot && plot.layout && plot.layout.xaxis) {
        const minSelected = Math.min(...selections);
        const maxSelected = Math.max(...selections);
        const minRange = Math.max(0, minSelected);
        const maxRange = Math.min(
          [...new Set(heatmapData.x)].length,
          maxSelected
        );
        const newRange = [minRange - 0.5, maxRange + 0.5];
        setSelectedRange(newRange as [number, number]);

        // Use Plotly.react to update the range and force a re-render
        Plotly.relayout(plot, {
          "xaxis.autorange": false,
          "xaxis.range": newRange as [Datum, Datum],
          ...({
            "xaxis2.fixedrange": true,
            "yaxis2.fixedrange": true,
          } as object),
        });

        const showTickLabels = getShowXAxisTickLabels();
        setShowFullAxisTickLabels(showTickLabels);
      }
    };

    // When the window is greater than 1250 in width, the Heatmap and barchart can fit
    // side-by-side. When the window is smaller than 1250, we need to adjust the grid
    // property in the Layout trace to display the barchart subplot underneath the Heatmap.
    window.addEventListener(
      "resize",
      debounce(() => {
        updateLayoutOnScreenSizeChange(plot);
      }, 200)
    );

    // Add a downloadImage method to the plot for PNG and SVG export using Plotly's toImage utility
    plot.downloadImage = (options) => {
      const { filename, width, format } = options;
      if (!plot || !plot.data || !plot.layout) return;
      Plotly.toImage(plot, { format, width, height: options.height })
        .then((dataUrl) => {
          const a = document.createElement("a");
          a.href = dataUrl;
          a.download = filename + "." + format;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
        })
        .catch(() => {
          if (format === "svg") {
            const svgNode = plot.querySelector("svg");
            if (!svgNode) return;
            const serializer = new XMLSerializer();
            const svgString = serializer.serializeToString(svgNode);
            const blob = new Blob([svgString], { type: "image/svg+xml" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = filename + ".svg";
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
          }
        });
    };

    return () => {
      listeners.forEach(([eventName, callback]) =>
        plot.removeListener(eventName, callback)
      );
    };
  }, [
    heatmapData,
    barChartXAxisTitle,
    getShowXAxisTickLabels,
    onSelectColumnRange,
    selectedColumns,
    legendTitle,
    selectedRange,
    hoveredColumns,
    onClearSelection,
    hovertemplate,
    zmin,
    zmax,
    xAxisTickLabels,
    barChartData,
    heatmapXAxisTitle,
    updateLayoutOnScreenSizeChange,
    Plotly,
  ]);

  return (
    <>
      <h3 style={{ textAlign: "center" }}>{plotTitle}</h3>
      <div className={styles.HeatmapBarChart} ref={ref} />
    </>
  );
}

export default function LazyHeatmapBarChart({
  heatmapData,
  barChartData,
  ...otherProps
}: Props) {
  return (
    <PlotlyLoader version="module">
      {(Plotly) =>
        heatmapData ? (
          <HeatmapBarChart
            heatmapData={heatmapData}
            barChartData={barChartData}
            Plotly={Plotly}
            {...otherProps}
          />
        ) : null
      }
    </PlotlyLoader>
  );
}
