import React, { useEffect, useRef, useState } from "react";
import type { Data as PlotlyData, Layout, PlotlyHTMLElement } from "plotly.js";
import PlotlyLoader, { PlotlyType } from "src/plot/components/PlotlyLoader";
import customizeDragLayer from "./customizeDragLayer";

import ExtendedPlotType from "src/plot/models/ExtendedPlotType";
import { generateTickLabels } from "./utils";
import usePlotResizer from "../../hooks/usePlotResizer";
import { DO_LOG2_PLOT_DATA } from "src/compound/heatmapTab/heatmapPlotUtils";

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
        zmin: DO_LOG2_PLOT_DATA ? -2 : 0,
        zmax: DO_LOG2_PLOT_DATA ? 0 : 1,
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

    Plotly.react(plot, plotlyData, layout);

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
            Math.min(data.x.length - 1, maxSelected + 1),
          ],
        });
      }
    };

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
