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
import HeatmapBrush from "src/doseViabilityPrototype/components/PrototypeBrushableHeatmap/HeatmapBrush";

interface Props {
  data: {
    x: string[];
    y: string[];
    z: (number | null)[][];
  };
  xAxisTitle: string;
  yAxisTitle: string;
  legendTitle: string;
  selectedCells: Set<string>;
  onClickColumn: (index: number, shiftKey: boolean) => void;
}

type PlotlyType = typeof import("plotly.js");

type PlotElement = HTMLDivElement &
  PlotlyHTMLElement & {
    data: PlotData[];
    layout: Layout;
    config: Config;
    removeListener: (eventName: string, callback: (e: object) => void) => void;
  };

function PrototypeBrushableHeatmap({
  data,
  xAxisTitle,
  yAxisTitle,
  legendTitle,
  selectedCells,
  onClickColumn,
  Plotly,
}: Props & { Plotly: PlotlyType }) {
  const ref = useRef<PlotElement>(null);
  usePlotResizer(Plotly, ref);

  const initialRange: [number, number] = useMemo(() => {
    return [-1, Math.min(100, data.x.length - 1)];
  }, [data]);

  const [selectedRange, setSelectedRange] = useState(initialRange);
  const [containerWidth, setContainerWidth] = useState(0);

  useEffect(() => {
    const plot = ref.current as PlotElement;

    const plotlyData: PlotlyData[] = [
      {
        type: "heatmap",
        ...data,
        colorscale: "YlOrRd",
        xaxis: "x",
        yaxis: "y",
        // Add some undocumented features (unfortunately these won't type check)
        // https://github.com/plotly/plotly.js/blob/041c8dc/src/traces/heatmap/attributes.js
        ...{ hoverongaps: false, xgap: 1, ygap: 1 },

        colorbar: {
          x: -0.004,
          y: -0.3,
          len: 0.2,
          ypad: 0,
          xanchor: "left",
          // More undocumented features
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
        tickvals: data.x.map((val, i) =>
          selectedCells.has(`${i},0`) ? val : ""
        ),
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

      // We use `shapes` to draw the selected cells.
      shapes: [...selectedCells]
        .map((cellAsString) => {
          const cell = cellAsString.split(",").map(Number);
          const shouldDrawTop = !selectedCells.has(`${cell[0]},${cell[1] - 1}`);
          const shouldDrawBottom = !selectedCells.has(
            `${cell[0]},${cell[1] + 1}`
          );

          return [
            // Outline
            {
              type: "path" as const,
              line: { width: 2, color: "black" },
              path: (() => {
                const p1 = [0.5 + cell[0], 0.5 + cell[1]].join(" ");
                const p2 = [-0.5 + cell[0], 0.5 + cell[1]].join(" ");
                const p3 = [-0.5 + cell[0], -0.5 + cell[1]].join(" ");
                const p4 = [0.5 + cell[0], -0.5 + cell[1]].join(" ");

                const segments: string[] = [];

                if (shouldDrawBottom) {
                  segments.push(`M ${p1} L ${p2}`);
                }

                segments.push(`M ${p2} L ${p3}`);
                segments.push(`M ${p4} L ${p1}`);

                if (shouldDrawTop) {
                  segments.push(`M ${p3} L ${p4}`);
                }

                return segments.join(" ");
              })(),
            },
            // Fill
            {
              type: "rect" as const,
              x0: cell[0] - 0.5,
              x1: cell[0] + 0.5,
              y0: cell[1] - 0.5,
              y1: cell[1] + 0.5,
              line: { width: 0 },
              fillcolor: "rgba(0, 0, 0, 0.1)",
            },
          ];
        })
        .flat(),
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

    on("plotly_click", (e: any) => {
      onClickColumn?.(e.points[0].pointIndex[1], e.event.shiftKey);
    });

    on("plotly_afterplot", () => {
      const dragLayers = plot.querySelectorAll(
        ".draglayer .drag:not(.nsewdrag)"
      ) as NodeListOf<HTMLDivElement>;

      [...dragLayers].forEach((el) => {
        el?.style.setProperty("display", "none");
      });

      setContainerWidth(plot.clientWidth);
    });

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
    selectedCells,
    onClickColumn,
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
