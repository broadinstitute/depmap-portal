import React, { useEffect, useMemo, useRef, useState } from "react";
import type {
  Config,
  Data as PlotlyData,
  Layout,
  PlotlyHTMLElement,
} from "plotly.js";
import PlotlyLoader from "src/plot/components/PlotlyLoader";
import HeatmapBrush from "./HeatmapBrush";
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

type PlotlyType = typeof import("plotly.js");

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

  const initialRange: [number, number] = useMemo(() => {
    return [0, data.x.length - 1];
  }, [data]);

  // Store the user's intended range
  const [selectedRange, setSelectedRange] = useState(initialRange);
  const [containerWidth, setContainerWidth] = useState(0);
  const [hoveredColumns, setHoveredColumns] = useState<number[]>([]);
  // Track whether the user is actively dragging the brush
  const [isUserDraggingBrush, setIsUserDraggingBrush] = useState(false);

  // Track if the last range change was user-driven (brush drag)
  const lastRangeChangeWasUser = useRef(false);

  // Respond to selectedColumns changes by shifting or zooming out as needed
  useEffect(() => {
    if (isUserDraggingBrush) return; // Don't auto-shift/zoom while user is dragging
    if (lastRangeChangeWasUser.current) {
      lastRangeChangeWasUser.current = false;
      return; // Don't auto-shift/zoom immediately after user drag ends
    }
    if (!selectedColumns || selectedColumns.size === 0) return;
    const sorted = Array.from(selectedColumns).sort((a, b) => a - b);
    const minSel = sorted[0];
    const maxSel = sorted[sorted.length - 1];
    const delta = selectedRange[1] - selectedRange[0];
    // If all selected columns are already in view, do nothing
    if (minSel >= selectedRange[0] && maxSel <= selectedRange[1]) return;
    // If selection is wider than current delta, zoom out to fit
    if (maxSel - minSel + 1 > delta) {
      const newStart = Math.max(0, minSel);
      const newEnd = Math.min(data.x.length - 1, maxSel);
      if (newStart !== selectedRange[0] || newEnd !== selectedRange[1]) {
        setSelectedRange([newStart, newEnd]);
      }
    } else {
      // Shift the window to fit the selection, maintaining delta
      let newStart = Math.max(0, Math.min(minSel, data.x.length - 1 - delta));
      let newEnd = newStart + delta;
      if (newEnd > data.x.length - 1) {
        newEnd = data.x.length - 1;
        newStart = Math.max(0, newEnd - delta);
      }
      if (newStart !== selectedRange[0] || newEnd !== selectedRange[1]) {
        setSelectedRange([newStart, newEnd]);
      }
    }
  }, [selectedColumns, data.x.length, selectedRange, isUserDraggingBrush]);

  // When the brush changes the range, mark it as user-driven
  const handleChangeRange = (range: [number, number]) => {
    if (isUserDraggingBrush) {
      lastRangeChangeWasUser.current = true;
    }
    setSelectedRange(range);
  };

  const pixelDistanceBetweenColumns = useMemo(() => {
    if (ref.current) {
      const dataToPiixels = (ref.current as any)._fullLayout.xaxis.l2p;
      return dataToPiixels(1) - dataToPiixels(0);
    }

    return 0;
    // eslint-disable-next-line
  }, [selectedRange]);

  const xAxisTickLabels = useMemo(() => {
    // Truncate labels longer than 15 characters with ellipsis
    return generateTickLabels(
      data.x.map((val) => {
        const str = String(val);
        return str.length > 15 ? str.slice(0, 15) + "..." : str;
      }),
      selectedColumns,
      pixelDistanceBetweenColumns
    );
  }, [data.x, selectedColumns, pixelDistanceBetweenColumns]);

  useEffect(() => {
    if (onLoad && ref.current) {
      onLoad(ref.current);
    }
  }, [onLoad]);

  useEffect(() => {
    const plot = ref.current as ExtendedPlotType;
    const deltaRange = selectedRange[1] - selectedRange[0];

    const plotlyData: PlotlyData[] = [
      {
        type: "heatmap",
        ...data,
        colorscale: "YlOrRd",
        zmin: -2,
        zmax: 0,
        colorbar: {
          x: -0.009,
          y: -0.3,
          len: 0.2,
          ypad: 0,
          xanchor: "left",
          // These features are undocumented and won't type check properly.
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
        // We only want there to be gaps between cells once the user has
        // zoomed in a little. When the plot is fulled zoomed out, it should
        // look like a smooth gradient with no gaps.
        // While we could set a threshold where gaps suddenly appear, that
        // would be a litt jarring. Instead we'll use some fancy math to
        // gradually increase the gap size as a function of the zoom level.
        xgap: 3 * (1 - deltaRange / data.x.length) ** 2,
        ygap: 1 * (1 - deltaRange / data.x.length) ** 2,
      },
    ];

    const layout: Partial<Layout> = {
      height: 500,
      margin: { t: 50, l: 40, r: 0, b: 0 },
      hovermode: "closest",
      hoverlabel: { namelength: -1 },
      dragmode: false,
      xaxis: {
        title: xAxisTitle,
        side: "top",
        tickvals: xAxisTickLabels.map((label, i) => (label ? data.x[i] : "")),
        ticktext: xAxisTickLabels,
        tickmode: "array",
        tickangle: -25,
        tickfont: { size: 10 },
        automargin: true,
        range: selectedRange,
      },
      yaxis: {
        type: "category",
        automargin: true,
        autorange: true,
        title: {
          text: yAxisTitle,
          standoff: 10,
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

    // Add a downloadImage method to the plot for PNG and SVG export using Plotly's toImage utility (as in PrototypeDensity1D)
    plot.downloadImage = (options) => {
      const { filename, width, format } = options;
      if (!plot || !plot.data || !plot.layout) return;
      // Use Plotly's toImage for consistent export
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
          // fallback: try SVG serialization for SVG only
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
    selectedRange,
    selectedColumns,
    hoveredColumns,
    onSelectColumnRange,
    onClearSelection,
    hovertemplate,
    zmin,
    zmax,
    xAxisTickLabels,
    Plotly,
  ]);

  return (
    <div ref={ref}>
      <HeatmapBrush
        containerWidth={containerWidth}
        dataLength={data.x.length}
        range={selectedRange}
        onChangeRange={handleChangeRange}
        selectedColumns={selectedColumns}
        zoomDomain={[0, data.x.length - 1]}
        onBrushDragActive={setIsUserDraggingBrush}
      />
    </div>
  );
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
