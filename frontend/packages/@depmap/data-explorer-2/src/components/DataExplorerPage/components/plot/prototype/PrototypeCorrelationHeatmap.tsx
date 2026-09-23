import React, { useEffect, useRef, useState } from "react";
import type {
  Config,
  Data as PlotlyData,
  Layout,
  PlotlyHTMLElement,
  PlotMouseEvent,
} from "plotly.js";
import { usePlotlyLoader } from "../../../../../contexts/PlotlyLoaderContext";
import {
  calcChromeAxisOverrides,
  calcMinMax,
  cloneFigureForExport,
  DataExplorerColorPalette,
  DEFAULT_CHROME_LINE_WIDTH,
  DEFAULT_PALETTE,
  DEFAULT_TICK_FONT_SIZE,
  EXPORT_EDGE_PADDING,
  exportMarginFloor,
  releaseWebglContexts,
} from "./plotUtils";
import usePlotResizer from "./usePlotResizer";
import type ExtendedPlotType from "../../../ExtendedPlotType";

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
  // Export-only: row/column tick labels and the colorbar's own ticks (see
  // ExportImageModal's tickFontSize). Never fed by the live, on-screen
  // render — only the export preview passes anything other than the
  // default, so on screen this reproduces today's implicit Plotly default
  // exactly.
  tickFontSize?: number;
  // Reproduces the live plot's own zoom/pan state in a freshly-mounted
  // instance (the export preview) — see captureTransientState. Only yaxis
  // is threaded through, matching the only axis this renderer already
  // preserves across its own re-renders (see the plotly_relayout handler
  // below); x never has been.
  initialAxes?: Partial<Layout>;
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
  tickFontSize = DEFAULT_TICK_FONT_SIZE,
  initialAxes,
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
    yaxis: initialAxes?.yaxis,
  });

  // Skips the very first run: without this, the reset below would fire on
  // mount and immediately discard the seeded initialAxes above, before this
  // instance ever gets a chance to render with it — see the same pattern in
  // PrototypeDensity1D.
  const hasEverRunAxesReset = useRef(false);

  useEffect(() => {
    if (!hasEverRunAxesReset.current) {
      hasEverRunAxesReset.current = true;
      return;
    }

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
    const plot = ref.current;
    return () => {
      releaseWebglContexts(plot as HTMLElement);
      Plotly.purge(plot as HTMLElement);
    };
  }, [Plotly]);

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
        colorbar: { tickfont: { size: tickFontSize } },
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
    // See https://github.com/plotly/plotly.js/blob/041c8dc1/src/traces/heatmap/attributes.js#L80-L115
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

    const yaxis = {
      // `axes.current.yaxis`, once set (by a relayout, or seeded from
      // initialAxes), is reused as-is on every later render — including
      // ones where only tickFontSize changed. `tickfont` has to be applied
      // outside this fallback, not inside it, or the cached object just
      // keeps whatever font size was baked in the one time this object
      // literal last ran, which is exactly why only the x-axis (rebuilt
      // fresh below on every render, with no such cache) ever picked up a
      // new tickFontSize.
      ...(axes.current.yaxis || {
        type: "category" as const,
        automargin: true,
        autorange: true,
        tickvals: y,
        ticktext: yLabels ? yLabels.map(truncate) : y.map(truncate),
        domain: z2Key ? [0.25, 0.75] : [0, 1],
      }),
      tickfont: { size: tickFontSize },
    };

    const layout: Partial<Layout> = {
      height: height === "auto" ? calcPlotHeight(plot) : height,
      margin: { t: 30, l: 80, r: 30, b: 130 },
      hovermode: "closest",
      hoverlabel: { namelength: -1 },

      xaxis: {
        type: "category",
        tickvals: x,
        ticktext: xLabels ? xLabels.map(truncate) : x.map(truncate),
        tickfont: { size: tickFontSize },
        domain: [0, z2Key ? doubleHeatMapRatio : 1],
        title: { text: zLabel, standoff: 10, font: { size: xAxisFontSize } },
      },

      yaxis,

      ...(z2Key && {
        xaxis2: {
          type: "category",
          tickvals: x,
          ticktext: xLabels ? xLabels.map(truncate) : x.map(truncate),
          tickfont: { size: tickFontSize },
          domain: [1 - doubleHeatMapRatio, 1],
          anchor: "y2",
          title: { text: z2Label, standoff: 10, font: { size: xAxisFontSize } },
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
            // Plotly.react's live rendering tolerates a `null` entry here
            // silently (it's simply not part of layout.shapes on the live
            // plot without a second heatmap), but Plotly.toImage's static
            // rendering path doesn't: it coerces the `null` into a shape
            // with every attribute at Plotly's own default — `type: "rect"`,
            // `xref`/`yref: "paper"`, spanning the full plot 0 to 1, with a
            // black border — which is exactly the large black rectangle
            // that only ever showed up in an export, and only without a
            // second heatmap to fill this slot with a real shape instead.
          ].filter(Boolean)
        : null,
    };

    const config: Partial<Config> = {
      // Automatically resizes the plot when the window is resized.
      responsive: true,
      displaylogo: false,
      modeBarButtonsToRemove: ["select2d", "lasso2d"],
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
    // Unlike the scatter and density renderers, the heatmap needs no legend
    // stand-ins or reshaped lines — there are no points, no annotations and
    // no color-by legend to stand in for. `downloadImage` keeps handing
    // Plotly this graph div directly (the safer of the two paths — Plotly
    // deep-copies a div but not a plain figure) for callers that don't need
    // the export options below; `getImageFigure` clones for those that do.
    plot.getImageFigure = (options) => {
      const edgePadding = options?.edgePadding ?? EXPORT_EDGE_PADDING;
      const chromeLineWidth =
        options?.chromeLineWidth ?? DEFAULT_CHROME_LINE_WIDTH;
      // `options.dataLineWidth`/`violinLineWidth` are accepted by the shared
      // getImageFigure type but unused here — no identity/regression lines
      // or violins on a heatmap. `options.yAxisLabel` is unused too — the Y
      // axis is a plain list of row tick labels, not a single title.
      const xAxisLabelOverride = options?.xAxisLabel;
      // Only meaningful with z2Key (the "distinguish" split) — otherwise
      // there's no second panel for it to label.
      const secondaryXAxisLabelOverride = options?.secondaryXAxisLabel;

      const chromeOverrides = calcChromeAxisOverrides(chromeLineWidth);

      const xaxisOverride = {
        ...plot.layout.xaxis,
        ...chromeOverrides,
        title: {
          ...(plot.layout.xaxis as any)?.title,
          ...(xAxisLabelOverride !== undefined
            ? { text: xAxisLabelOverride }
            : {}),
          standoff:
            ((plot.layout.xaxis as any)?.title?.standoff ?? 10) + edgePadding,
        },
      };

      return cloneFigureForExport(plot.data, {
        ...plot.layout,
        xaxis: xaxisOverride,
        yaxis: {
          ...plot.layout.yaxis,
          ...chromeOverrides,
        },
        // The z2Key ("distinguish" split) case has a second pair of axes
        // for its own panel. Chrome scales both; the label override has its
        // own control (secondaryXAxisLabel) and, like the primary axis,
        // grows standoff by edgePadding to match the margin seeded below.
        ...(z2Key
          ? {
              xaxis2: {
                ...plot.layout.xaxis2,
                ...chromeOverrides,
                title: {
                  ...(plot.layout.xaxis2 as any)?.title,
                  ...(secondaryXAxisLabelOverride !== undefined
                    ? { text: secondaryXAxisLabelOverride }
                    : {}),
                  standoff:
                    ((plot.layout.xaxis2 as any)?.title?.standoff ?? 10) +
                    edgePadding,
                },
              },
              yaxis2: { ...plot.layout.yaxis2, ...chromeOverrides },
            }
          : {}),
        // See exportMarginFloor: seeds the single-shot export render with
        // the margin this instance already converged to. `b` matches the
        // standoff growth above; `l` isn't grown to match — there's no
        // y-axis title standoff to seed room for here.
        margin: exportMarginFloor(plot, { b: edgePadding }),
      });
    };
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
        plot.removeListener?.(eventName, callback)
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
    tickFontSize,
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
  const PlotlyLoader = usePlotlyLoader();

  return (
    <PlotlyLoader version="module">
      {(Plotly) =>
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
