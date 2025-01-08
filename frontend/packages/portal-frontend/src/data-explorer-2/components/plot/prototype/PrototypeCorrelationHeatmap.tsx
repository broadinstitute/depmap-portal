import React, { useEffect, useRef, useState } from "react";
import type {
  Config,
  Data as PlotlyData,
  Layout,
  PlotlyHTMLElement,
  PlotMouseEvent,
} from "plotly.js";
import {
  calcMinMax,
  DataExplorerColorPalette,
  DEFAULT_PALETTE,
} from "src/data-explorer-2/components/plot/prototype/plotUtils";
import PlotlyLoader, {
  PlotlyType,
} from "src/data-explorer-2/components/plot/PlotlyLoader";
import usePlotResizer from "src/data-explorer-2/components/plot/prototype/usePlotResizer";
import type ExtendedPlotType from "src/plot/models/ExtendedPlotType";

type Data = {
  x: string[];
  y: string[];
  z: (number | undefined)[][];
  z2: (number | undefined)[][] | null;
  zLabel: string;
  z2Label: string;
} | null;

interface Props {
  data: Data | null;
  xLabels: string[];
  yLabels: string[];
  xKey: string;
  yKey: string;
  zKey: string;
  z2Key?: string;
  zLabel: string;
  z2Label?: string;
  // Height can be defined in pixels or set to "auto."  In auto mode, it will
  // attempt to fill the height of the viewport.
  height: number | "auto";
  selectedLabels?: Set<string>;
  onSelectLabels?: (labels: string[]) => void;
  onLoad?: (plot: ExtendedPlotType) => void;
  palette?: DataExplorerColorPalette;
  xAxisFontSize?: number;
  distinguish1Label: string | undefined;
  distinguish2Label: string | undefined;
}

const calcPlotHeight = (plot: HTMLDivElement) => {
  if (window.innerWidth < 900) {
    return 600;
  }

  return window.innerHeight - plot.offsetTop - 22;
};

const calcDoubleHeatmapRatio = (width: number) => {
  return (width - 75) / width - 0.5;
};

const truncate = (s: string) => {
  const MAX = 15;
  return s && s.length > MAX ? `${s.substr(0, MAX)}…` : s;
};

const calcPath = ([xIndex, yIndex]: [number, number]) => {
  const p1 = [-0.5 + xIndex, -0.5 + yIndex].join(" ");
  const p2 = [0.5 + xIndex, -0.5 + yIndex].join(" ");
  const p3 = [0.5 + xIndex, 0.5 + yIndex].join(" ");
  const p4 = [-0.5 + xIndex, 0.5 + yIndex].join(" ");

  return `M ${p1} L ${p2} L ${p3} L ${p4} Z`;
};

function PrototypeCorrelationHeatmap({
  data,
  xLabels,
  yLabels,
  xKey,
  yKey,
  zKey,
  z2Key,
  zLabel,
  z2Label,
  height,
  selectedLabels = new Set(),
  onSelectLabels = () => {},
  palette = DEFAULT_PALETTE,
  xAxisFontSize = 14,
  distinguish1Label = undefined,
  distinguish2Label = undefined,
  onLoad = () => {},
  Plotly,
}: any) {
  const ref = useRef<ExtendedPlotType>(null);
  usePlotResizer(Plotly, ref);
  const [doubleHeatMapRatio, setDoubleHeatMapRatio] = useState(42);

  useEffect(() => {
    const div = ref.current as HTMLElement;
    setDoubleHeatMapRatio(calcDoubleHeatmapRatio(div.clientWidth));
  }, []);

  const axes = useRef<Partial<Layout>>({
    yaxis: undefined,
  });

  useEffect(() => {
    axes.current = {
      yaxis: undefined,
    };
  }, [xKey, yKey, zLabel, z2Label, data]);

  // On mount, we call the `onLoad` callback with a reference to the DOM node
  // (which is extended with convenience functions).
  useEffect(() => {
    if (onLoad && ref.current) {
      onLoad(ref.current);
    }
  }, [onLoad]);

  useEffect(() => {
    const plot = ref.current as ExtendedPlotType;
    const x = data[xKey];
    const y = data[yKey];
    const z = data[zKey];
    const z2 = z2Key ? data[z2Key] : null;
    let zmin = Math.min(calcMinMax(z.flat()).min, 0);

    if (z2) {
      const z2Min = calcMinMax(z2.flat()).min;
      zmin = Math.min(zmin, z2Min);
    }

    const customdata = [];
    for (let index = 0; index < yLabels.length; index++) {
      const yVal = yLabels[index];
      const xRow = xLabels.map((xVal: string) => {
        return [xVal, yVal];
      });
      customdata.push(xRow);
    }

    let plotlyData: PlotlyData[] = [
      {
        type: "heatmap",
        name: zLabel,
        x,
        y,
        z,
        zmin,
        zmax: 1,
        text: z2
          ? z2.map((a: number[]) => a.map((n: number) => n?.toFixed(8)))
          : null,
        customdata,
        colorscale: palette.sequentialScale,
        xaxis: "x",
        yaxis: "y",
        hovertemplate: [
          `%{customdata[0]}<br>`,
          `%{customdata[1]}<br>`,
          !z2 ? "Correlation: %{z}<br>" : null,
          z2 ? `${distinguish1Label || "All"}: %{z}<br>` : null,
          z2 ? `${distinguish2Label}: %{text}` : null,
          "<extra></extra>",
        ]
          .filter(Boolean)
          .join(""),
      },
      z2Key
        ? {
            type: "heatmap",
            name: z2Label,
            x,
            y,
            z: z2,
            zmin,
            zmax: 1,
            text: z.map((a: number[]) => a.map((n: number) => n?.toFixed(8))),
            customdata,
            colorscale: palette.sequentialScale,
            showscale: false,
            xaxis: "x2",
            yaxis: "y2",
            hovertemplate: [
              `%{customdata[0]}<br>`,
              `%{customdata[1]}<br>`,
              z2 ? `${distinguish1Label || "All"}: %{text}<br>` : null,
              z2 ? `${distinguish2Label}: %{z}` : null,
              "<extra></extra>",
            ].join(""),
          }
        : (null as any),
    ];

    // Add some undocumented features (unfortunately these won't type check)
    // See /Users/rcreasi/ref/plotly.js/src/traces/heatmap/attributes.js
    plotlyData = plotlyData.map((trace) => ({
      ...trace,
      hoverongaps: false,
      xgap: 1,
      ygap: 1,
    }));

    let selectedPoint: any = null;

    for (let i = 0; i < x.length; i += 1) {
      for (let j = 0; j < y.length; j += 1) {
        const label1 = x[i];
        const label2 = y[j];

        if (z[j]?.[i] !== undefined) {
          if (
            label1 === label2 &&
            selectedLabels?.size === 1 &&
            selectedLabels.has(label1)
          ) {
            selectedPoint = [i, j];
          }

          if (
            label1 !== label2 &&
            selectedLabels?.size === 2 &&
            selectedLabels.has(label1) &&
            selectedLabels.has(label2)
          ) {
            selectedPoint = [i, j];
          }
        }
      }
    }

    const yaxis = axes.current.yaxis || {
      automargin: true,
      autorange: true,
      tickvals: y,
      ticktext: yLabels ? yLabels.map(truncate) : y.map(truncate),
      domain: z2Key ? [0.25, 0.75] : [0, 1],
    };

    const layout: Partial<Layout> = {
      height: height === "auto" ? calcPlotHeight(plot) : height,
      margin: { t: 30, l: 80, r: 30, b: 130 },
      hovermode: "closest",
      hoverlabel: { namelength: -1 },

      xaxis: {
        tickvals: x,
        ticktext: xLabels ? xLabels.map(truncate) : x.map(truncate),
        domain: [0, z2Key ? doubleHeatMapRatio : 1],
        title: { text: zLabel, standoff: 10, font: { size: xAxisFontSize } },
      },

      yaxis,

      ...(z2Key && {
        xaxis2: {
          tickvals: x,
          ticktext: xLabels ? xLabels.map(truncate) : x.map(truncate),
          domain: [1 - doubleHeatMapRatio, 1],
          anchor: "y2",
          title: { text: z2Label, standoff: 10 },
        },
      }),

      ...(z2Key && {
        yaxis2: { ...yaxis, anchor: "x2" },
      }),

      // Preserve the existing dragmode if present.
      dragmode: plot?.layout?.dragmode || "zoom",

      shapes: selectedPoint
        ? [
            {
              type: "path",
              path: calcPath(selectedPoint),
              xref: "x",
              yref: "y",
              line: { width: 2, color: "red" },
            },
            z2Key
              ? {
                  type: "path",
                  path: calcPath(selectedPoint),
                  xref: "x2",
                  yref: "y2",
                  line: { width: 2, color: "red" },
                }
              : null,
          ]
        : null,
    };

    const config: Partial<Config> = {
      // Automatically resizes the plot when the window is resized.
      responsive: true,
    };

    // Add a few non-standard methods to the plot for convenience.
    plot.setDragmode = (dragmode) => {
      setTimeout(() => {
        if (!plot.data) {
          return;
        }

        Plotly.update(plot, {}, { dragmode });
      }, 0);
    };

    // HACK: The zoom functions provided by Plotly's modebar aren't exposed
    // by its API. The only way to trigger them is by actually clicking the
    // buttons 😕
    const getButton = (attr: string, val: string) =>
      plot.querySelector(
        `.modebar-btn[data-attr="${attr}"][data-val="${val}"]`
      ) as HTMLAnchorElement;

    const zoom = (val: "in" | "out" | "reset") => {
      getButton("zoom", val).click();
    };

    plot.zoomIn = () => setTimeout(zoom, 0, "in");
    plot.zoomOut = () => setTimeout(zoom, 0, "out");
    plot.resetZoom = () => setTimeout(zoom, 0, "reset");
    plot.downloadImage = (options) => Plotly.downloadImage(plot, options);
    (plot as any).purge = () => Plotly.purge(plot);

    Plotly.react(plot, plotlyData, layout, config);

    // Keep track of added listeners so we can easily remove them.
    const listeners: [string, (e: any) => void][] = [];

    const on = (eventName: string, callback: (e: any) => void) => {
      plot.on(
        eventName as Parameters<PlotlyHTMLElement["on"]>[0],
        callback as Parameters<PlotlyHTMLElement["on"]>[1]
      );
      listeners.push([eventName, callback]);
    };

    on("plotly_click", (e: PlotMouseEvent) => {
      const px = e.points[0].x;
      const py = e.points[0].y;

      onSelectLabels?.([px, py]);
    });

    on("plotly_relayout", () => {
      axes.current = {
        yaxis: { ...plot.layout.yaxis, autorange: false },
      };
    });

    on("plotly_autosize", () => {
      if (height === "auto") {
        setTimeout(() => {
          plot.layout.height = calcPlotHeight(plot);
          Plotly.redraw(plot);
        });
      }

      setDoubleHeatMapRatio(calcDoubleHeatmapRatio(plot.clientWidth));
    });

    return () => {
      listeners.forEach(([eventName, callback]) =>
        plot.removeListener(eventName, callback)
      );
    };
  }, [
    data,
    xLabels,
    yLabels,
    xKey,
    yKey,
    zKey,
    z2Key,
    zLabel,
    z2Label,
    height,
    doubleHeatMapRatio,
    selectedLabels,
    onSelectLabels,
    palette,
    xAxisFontSize,
    distinguish1Label,
    distinguish2Label,
    Plotly,
  ]);

  return <div ref={ref} />;
}

export default function LazyPrototypeCorrelationHeatmap({
  data,
  ...otherProps
}: Props) {
  return (
    <PlotlyLoader version="module">
      {(Plotly: PlotlyType) =>
        data ? (
          <PrototypeCorrelationHeatmap
            data={data}
            Plotly={Plotly}
            {...otherProps}
          />
        ) : null
      }
    </PlotlyLoader>
  );
}
