import React, { useEffect, useMemo, useRef, useState } from "react";
import type {
  Config,
  Data as PlotlyData,
  Layout,
  PlotData,
  PlotlyHTMLElement,
  ColorScale,
} from "plotly.js";
import PlotlyLoader, { PlotlyType } from "src/plot/components/PlotlyLoader";
import usePlotResizer from "src/doseViabilityPrototype/hooks/usePlotResizer";
import customizeDragLayer from "src/doseViabilityPrototype/components/PrototypeBrushableHeatmap/customizeDragLayer";
import {
  BarChartFormattedData,
  HeatmapFormattedData,
} from "@depmap/types/src/experimental_genetea";
import ExtendedPlotType from "src/plot/models/ExtendedPlotType";
import { getDefaultLayout, getTabletScreenSizeLayout } from "./layouts";
import { generateTickLabels } from "../utils";

const viridisRColorscale = [
  ["0", "#D3D3D3"],
  ["0.001", "rgb(253, 231, 37)"],
  ["0.111", "rgb(180, 222, 44)"],
  ["0.222", "rgb(109, 205, 89)"],
  ["0.333", "rgb(53, 183, 121)"],
  ["0.444", "rgb(31, 158, 137)"],
  ["0.556", "rgb(38, 130, 142)"],
  ["0.667", "rgb(49, 104, 142)"],
  ["0.778", "rgb(62, 74, 137)"],
  ["0.889", "rgb(72, 40, 120)"],
  ["1.0", "rgb(68, 1, 84)"],
];
interface Props {
  heatmapXAxisTitle: string;
  heatmapData: HeatmapFormattedData;
  barChartXAxisTitle: string;
  barChartData: BarChartFormattedData;
  legendTitle: string;
  selectedColumns: Set<number>;
  onSelectColumnRange: (start: number, end: number, shiftKey: boolean) => void;
  onClearSelection: () => void;
  onLoad: (plot: ExtendedPlotType) => void;
  hovertemplate?: string | string[];
  // Optionally set a min/max for the color scale. If left undefined, these
  // will default to the min and max of values contained in `data.z`
  zmin?: number;
  zmax?: number;
}

function HeatmapBarChart({
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

  useEffect(() => {
    if (onLoad && ref.current) {
      onLoad(ref.current);
    }
  }, [onLoad]);

  const initialRange: [number, number] = useMemo(() => {
    return [0, heatmapData.x.length - 1];
  }, [heatmapData]);

  const [selectedRange, setSelectedRange] = useState(initialRange);
  const [containerWidth, setContainerWidth] = useState(0);
  const [hoveredColumns, setHoveredColumns] = useState<number[]>([]);

  const xAxisTickLabels = generateTickLabels(
    [...new Set(heatmapData.x)].map((val) => {
      const str = String(val);
      return str.length > 8 ? str.slice(0, 8) + "..." : str;
    }),
    selectedColumns
  );

  useEffect(() => {
    const plot = ref.current as ExtendedPlotType;
    let range: [number, number] = [0, [...new Set(heatmapData.x)].length - 1];
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
      colorscale: viridisRColorscale as ColorScale,
      zmin: 0,
      zmax: 1,
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
      orientation: "h",
      marker: {
        color: "#777b7e",
      },
    };

    const layout: Partial<Layout> =
      window.innerWidth < 1200
        ? getTabletScreenSizeLayout(
            heatmapData,
            heatmapXAxisTitle,
            barChartXAxisTitle,
            xAxisTickLabels,
            new Set(hoveredColumns),
            selectedColumns,
            range
          )
        : getDefaultLayout(
            heatmapData,
            heatmapXAxisTitle,
            barChartXAxisTitle,
            xAxisTickLabels,
            new Set(hoveredColumns),
            selectedColumns,
            range
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
      setContainerWidth(plot.clientWidth);

      customizeDragLayer({
        plot,
        onMouseOut: () => setHoveredColumns([]),
        onChangeInProgressSelection: (start, end) => {
          const range = [];
          for (let i = start; i <= end; i += 1) {
            range.push(i);
          }
          setHoveredColumns(range);
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

        // Use Plotly.react to update the range and force a re-render
        Plotly.relayout(plot, {
          "xaxis.autorange": false,
          "xaxis.range": [
            Math.max(0, minSelected - 1),
            Math.min([...new Set(heatmapData.x)].length - 1, maxSelected + 1),
          ],
        });
      }
    };

    // Event listener for window resize
    // window.addEventListener("resize", updateLayoutOnScreenSizeChange);

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
    Plotly,
  ]);

  return <div ref={ref} />;
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
