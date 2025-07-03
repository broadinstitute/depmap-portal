import React, { useEffect, useRef, useState } from "react";
import type {
  Config,
  Data as PlotlyData,
  Layout,
  PlotlyHTMLElement,
} from "plotly.js";
import PlotlyLoader, { PlotlyType } from "src/plot/components/PlotlyLoader";
import customizeDragLayer from "./customizeDragLayer";

import ExtendedPlotType from "src/plot/models/ExtendedPlotType";
import { generateTickLabels } from "./utils";
import usePlotResizer from "../../hooks/usePlotResizer";

interface Props {
  data: {
    x: (string | number)[];
    y: (string | number)[];
    z: (number | null)[][];
    customdata?: any[][]; // Add customdata for per-cell hover masking
  };
  xAxisTitle: string;
  yAxisTitle: string;
  legendTitle: string;
  selectedColumns: Set<number>;
  onSelectColumnRange: (start: number, end: number, shiftKey: boolean) => void;
  onClearSelection: () => void;
  onLoad?: (plot: ExtendedPlotType) => void;
  hovertemplate?: string | string[];
  // Optionally set a min/max for the color scale. If left undefined, these
  // will default to the min and max of values contained in `data.z`
  zmin?: number;
  zmax?: number;
}

function PrototypeBrushableHeatmap({
  data,
  xAxisTitle,
  yAxisTitle,
  legendTitle,
  selectedColumns,
  onSelectColumnRange,
  onClearSelection,
  hovertemplate = undefined,
  zmin = undefined,
  zmax = undefined,
  onLoad = () => {},
  Plotly,
}: Props & { Plotly: PlotlyType }) {
  const ref = useRef<ExtendedPlotType>(null);
  usePlotResizer(Plotly, ref);

  const [hoveredColumns, setHoveredColumns] = useState<number[]>([]);

  useEffect(() => {
    if (onLoad && ref.current) {
      onLoad(ref.current);
    }
  }, [onLoad]);

  useEffect(() => {
    const plot = ref.current as ExtendedPlotType;
    // Determine the visible range for tick label logic
    let range: [number, number] = [0, data.x.length - 1];
    if (
      plot &&
      plot.layout &&
      plot.layout.xaxis &&
      Array.isArray(plot.layout.xaxis.range) &&
      plot.layout.xaxis.range.length === 2
    ) {
      range = plot.layout.xaxis.range as [number, number];
    }

    const xAxisTickLabels = generateTickLabels(
      data.x.map((val) => {
        const str = String(val);
        return str.length > 15 ? str.slice(0, 15) + "..." : str;
      }),
      selectedColumns
    );

    const plotlyData: PlotlyData[] = [
      {
        type: "heatmap",
        ...data,
        colorscale: "YlOrRd",
        zmin: -2,
        zmax: 0,
        colorbar: {
          x: -0.009,
          y: -0.4,
          len: 0.2,
          ypad: 0,
          xanchor: "left",
          ...({
            orientation: "h",
            title: {
              text: legendTitle,
              side: "bottom",
            },
          } as object),
        },
        hovertemplate,
        xaxis: "x",
        yaxis: "y",
        xgap: 0.15,
        ygap: 0.15,
      },
    ];

    const layout: Partial<Layout> = {
      height: 500,
      margin: { t: 50, l: 40, r: 10, b: 10 },
      hovermode: "closest",
      hoverlabel: { namelength: -1 },
      dragmode: false,
      xaxis: {
        title: xAxisTitle,
        side: "top",
        tickvals: xAxisTickLabels.map((label, i) => (label ? data.x[i] : "")),
        ticktext: xAxisTickLabels,
        tickmode: "array",
        tickangle: -45,
        tickfont: { size: 10 },
        automargin: true,
        rangeslider: {
          thickness: 0.05,
          visible: true,
          borderwidth: 2,
        },
        range,
      },
      yaxis: {
        type: "category",
        automargin: true,
        autorange: true,
        title: {
          text: yAxisTitle,
        },
      },
      // We use `shapes` to draw the hovered and selected columns
      shapes: [
        // Outline
        [...selectedColumns].map((colIndex) => ({
          type: "path" as const,
          line: { width: 2, color: "black" },
          path: (() => {
            const x0 = colIndex - 0.5;
            const x1 = colIndex + 0.5;
            const y0 = -0.5;
            const y1 = data.y.length - 0.5;
            const shouldDrawLeft = !selectedColumns.has(colIndex! - 1);
            const shouldDrawRight = !selectedColumns.has(colIndex! + 1);

            const segments: string[] = [];

            if (shouldDrawLeft) {
              segments.push(`M ${x0} ${y0}`);
              segments.push(`L ${x0} ${y1}`);
            }

            segments.push(`M ${x0} ${y1}`);
            segments.push(`L ${x1} ${y1}`);
            segments.push(`M ${x1} ${y0}`);
            segments.push(`L ${x0} ${y0}`);

            if (shouldDrawRight) {
              segments.push(`M ${x1} ${y1}`);
              segments.push(`L ${x1} ${y0}`);
            }

            return segments.join(" ");
          })(),
        })),

        // Fill
        [...new Set([...hoveredColumns, ...selectedColumns])].map(
          (colIndex) => ({
            type: "rect" as const,
            x0: colIndex - 0.5,
            x1: colIndex + 0.5,
            y0: -0.5,
            y1: data.y.length - 0.5,
            line: { width: 0 },
            fillcolor: "rgba(0, 0, 0, 0.15)",
          })
        ),
      ].flat(),
    };

    const config: Partial<Config> = {
      displayModeBar: false,
    };

    Plotly.react(plot, plotlyData, layout, config);

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
      customizeDragLayer({
        plot,
        onMouseOut: () => setHoveredColumns([]),
        onChangeInProgressSelection: (start, end) => {
          const selectRange = [];
          for (let i = start; i <= end; i += 1) {
            selectRange.push(i);
          }
          setHoveredColumns(selectRange);
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
    data,
    xAxisTitle,
    yAxisTitle,
    legendTitle,
    onSelectColumnRange,
    onClearSelection,
    hovertemplate,
    zmin,
    zmax,
    Plotly,
    selectedColumns,
    hoveredColumns,
  ]);

  // --- Auto-zoom if a selected column is out of view ---
  useEffect(() => {
    const plot = ref.current as ExtendedPlotType;
    if (selectedColumns.size > 0 && plot && plot.layout && plot.layout.xaxis) {
      let xRange: [number, number] = [0, data.x.length - 1];
      if (
        plot.layout.xaxis.range &&
        Array.isArray(plot.layout.xaxis.range) &&
        plot.layout.xaxis.range.length === 2
      ) {
        xRange = plot.layout.xaxis.range as [number, number];
      }
      const minSelected = Math.min(...selectedColumns);
      const maxSelected = Math.max(...selectedColumns);
      // If any selected column is out of view, zoom out to fit all selected
      if (minSelected < xRange[0] || maxSelected > xRange[1]) {
        // Use Plotly.react to update the range and force a re-render
        Plotly.relayout(plot, {
          "xaxis.autorange": false,
          "xaxis.range": [
            Math.max(0, minSelected - 1),
            Math.min(data.x.length - 1, maxSelected + 1),
          ],
        });
      }
    }
  }, [
    data,
    xAxisTitle,
    yAxisTitle,
    legendTitle,
    onSelectColumnRange,
    onClearSelection,
    hovertemplate,
    zmin,
    zmax,
    selectedColumns,
    Plotly,
  ]);

  return <div ref={ref} />;
}

export default function LazyPrototypeBrushableHeatmap({
  data,
  ...otherProps
}: Props) {
  return (
    <PlotlyLoader version="module">
      {(Plotly) =>
        data ? (
          <PrototypeBrushableHeatmap
            data={data}
            Plotly={Plotly}
            {...otherProps}
          />
        ) : null
      }
    </PlotlyLoader>
  );
}
