import React, { useEffect, useMemo, useRef, useState } from "react";
import type {
  Config,
  Data as PlotlyData,
  Layout,
  PlotData,
  PlotlyHTMLElement,
} from "plotly.js";
import PlotlyLoader from "src/plot/components/PlotlyLoader";
import usePlotResizer from "src/doseViabilityPrototype/hooks/usePlotResizer";
import customizeDragLayer from "src/doseViabilityPrototype/components/PrototypeBrushableHeatmap/customizeDragLayer";
import { generateTickLabels } from "src/doseViabilityPrototype/components/PrototypeBrushableHeatmap/utils";
import {
  BarChartFormattedData,
  HeatmapFormattedData,
} from "@depmap/types/src/experimental_genetea";

interface Props {
  heatmapData: HeatmapFormattedData;
  barChartData: BarChartFormattedData;
  xAxisTitle: string;
  yAxisTitle: string;
  legendTitle: string;
  onClearSelection: () => void;
  hovertemplate?: string | string[];
  // Optionally set a min/max for the color scale. If left undefined, these
  // will default to the min and max of values contained in `data.z`
  zmin?: number;
  zmax?: number;
}

type PlotlyType = typeof import("plotly.js");

type PlotElement = HTMLDivElement &
  PlotlyHTMLElement & {
    data: PlotData[];
    layout: Layout;
    config: Config;
    removeListener: (eventName: string, callback: (e: object) => void) => void;
  };

function HeatmapBarChart({
  heatmapData,
  barChartData,
  xAxisTitle,
  yAxisTitle,
  legendTitle,
  onClearSelection,
  hovertemplate = undefined,
  zmin = undefined,
  zmax = undefined,
  Plotly,
}: Props & { Plotly: PlotlyType }) {
  const ref = useRef<PlotElement>(null);
  usePlotResizer(Plotly, ref);

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
    const plot = ref.current as PlotElement;
    const deltaRange = selectedRange[1] - selectedRange[0];

    const plotlyData: PlotlyData[] = [
      {
        type: "heatmap",
        ...heatmapData,
        colorscale: "YlOrRd",
        xaxis: "x",
        yaxis: "y",
        zmin,
        zmax,
        hovertemplate,
        // We only want there to be gaps between cells once the user has
        // zoomed in a little. When the plot is fulled zoomed out, it should
        // look like a smooth gradient with no gaps.
        // While we could set a threshold where gaps suddenly appear, that
        // would be a litt jarring. Instead we'll use some fancy math to
        // gradually increase the gap size as a function of the zoom level.
        xgap: 3 * (1 - deltaRange / heatmapData.x.length) ** 2,
        ygap: 1 * (1 - deltaRange / heatmapData.x.length) ** 2,

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
        tickvals: xAxisTickLabels.map((label, i) =>
          label ? heatmapData.x[i] : ""
        ),
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
          () => {};
        },
        onClearSelection,
      });
    });

    on("plotly_hover", (e: any) => {
      setHoveredColumns([e.points[0].pointIndex[1]]);
    });

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
