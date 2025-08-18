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
import { generateTickLabels } from "src/doseViabilityPrototype/components/PrototypeBrushableHeatmap/utils";
import {
  BarChartFormattedData,
  HeatmapFormattedData,
} from "@depmap/types/src/experimental_genetea";
import ExtendedPlotType from "src/plot/models/ExtendedPlotType";

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
  barChartData: BarChartFormattedData;
  xAxisTitle: string;
  yAxisTitle: string;
  legendTitle: string;
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
  barChartData,
  xAxisTitle,
  yAxisTitle,
  legendTitle,
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

  const pixelDistanceBetweenColumns = useMemo(() => {
    if (ref.current) {
      const dataToPiixels = (ref.current as any)._fullLayout.xaxis.l2p;
      return dataToPiixels(1) - dataToPiixels(0);
    }

    return 0;
    // eslint-disable-next-line
  }, [selectedRange]);

  const xAxisTickLabels = useMemo(() => {
    return generateTickLabels(
      heatmapData.x.map(String),
      new Set([0, 1, 2, 3]),
      pixelDistanceBetweenColumns
    );
  }, [heatmapData.x, pixelDistanceBetweenColumns]);

  useEffect(() => {
    const plot = ref.current as ExtendedPlotType;
    const deltaRange = selectedRange[1] - selectedRange[0];

    const plotlyHeatmapData: PlotlyData = {
      type: "heatmap",
      ...heatmapData,
      colorscale: viridisRColorscale as ColorScale,
      zmin: 0,
      zmax: 1,
      xaxis: "x",
      yaxis: "y",
      hovertemplate,
      xgap: 5,
      ygap: 5,

      colorbar: {
        x: -0.2,
        y: -0.3,
        len: 0.2,
        ypad: 0,
        xanchor: "left",
        // These features are undocumented and won't type check properly.
        ...({
          orientation: "h",
          title: {
            text: "Fraction Matching",
            side: "top",
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

    const layout: Partial<Layout> = {
      height: 500,
      margin: { t: 50, l: 240, r: 0, b: 50 },
      hovermode: "closest",
      hoverlabel: { namelength: -1 },
      dragmode: false,
      xaxis: { domain: [0, 0.7], title: heatmapXAxisTitle, showgrid: false },
      yaxis: { showgrid: false },
      yaxis2: { anchor: "x2", visible: false },
      xaxis2: { domain: [0.73, 1], title: "-log FDR" },

      // We use `shapes` to draw the hovered and selected columns
      shapes: [
        // Fill
        [...new Set([...hoveredColumns])].map((colIndex) => ({
          type: "rect" as const,
          x0: colIndex - 0.5,
          x1: colIndex + 0.5,
          y0: -0.5,
          y1: heatmapData.y.length - 0.5,
          line: { width: 0 },
          fillcolor: "rgba(0, 0, 0, 0.15)",
        })),
      ].flat(),
    };

    const config: Partial<Config> = {
      displayModeBar: false,
    };

    Plotly.react(plot, [plotlyHeatmapData, plotlyBarChartData], layout, config);

    // Keep track of added listeners so we can easily remove them.
    const listeners: [string, (e: object) => void][] = [];

    const on = (eventName: string, callback: (e: object) => void) => {
      plot.on(
        eventName as Parameters<PlotlyHTMLElement["on"]>[0],
        callback as Parameters<PlotlyHTMLElement["on"]>[1]
      );
      listeners.push([eventName, callback]);
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
          () => {};
        },
        onClearSelection,
      });
    });

    on("plotly_hover", (e: any) => {
      setHoveredColumns([e.points[0].pointIndex[1]]);
    });

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
    xAxisTitle,
    yAxisTitle,
    legendTitle,
    selectedRange,
    hoveredColumns,
    onClearSelection,
    hovertemplate,
    zmin,
    zmax,
    xAxisTickLabels,
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
