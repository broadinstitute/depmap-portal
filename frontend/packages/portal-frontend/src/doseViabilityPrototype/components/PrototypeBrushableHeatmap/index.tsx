import React, { useEffect, useMemo, useRef, useState } from "react";
import type {
  Config,
  Data as PlotlyData,
  Layout,
  // PlotData,
  PlotlyHTMLElement,
} from "plotly.js";
import PlotlyLoader from "src/plot/components/PlotlyLoader";
import usePlotResizer from "src/doseViabilityPrototype/hooks/usePlotResizer";
import HeatmapBrush from "src/doseViabilityPrototype/components/PrototypeBrushableHeatmap/HeatmapBrush";
import customizeDragLayer from "src/doseViabilityPrototype/components/PrototypeBrushableHeatmap/customizeDragLayer";
import { generateTickLabels } from "src/doseViabilityPrototype/components/PrototypeBrushableHeatmap/utils";
import ExtendedPlotType from "src/plot/models/ExtendedPlotType";

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

// type PlotElement = HTMLDivElement &
//   PlotlyHTMLElement & {
//     data: PlotData[];
//     layout: Layout;
//     config: Config;
//     removeListener: (eventName: string, callback: (e: object) => void) => void;
//   };

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
      data.x.map(String),
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
    const plot = ref.current as ExtendedPlotType; // as PlotElement;
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
        side: "top",
        tickvals: xAxisTickLabels.map((label, i) => (label ? data.x[i] : "")),
        ticktext: xAxisTickLabels,
        title: xAxisTitle,
        range: selectedRange,
      },

      yaxis: {
        type: "category",
        automargin: true,
        autorange: true,
        title: {
          text: yAxisTitle,
          standoff: 15,
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
        initialRange={initialRange}
        onChangeRange={setSelectedRange}
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
