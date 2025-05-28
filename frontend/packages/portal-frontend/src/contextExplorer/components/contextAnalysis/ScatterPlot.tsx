/* eslint-disable react/require-default-props */
/* eslint-disable no-nested-ternary */
import React, { useEffect, useMemo, useRef } from "react";
import type {
  Config,
  Layout,
  PlotlyHTMLElement,
  PlotMouseEvent,
} from "plotly.js";
import PlotlyLoader, { PlotlyType } from "src/plot/components/PlotlyLoader";
import { DEFAULT_PALETTE } from "@depmap/data-explorer-2";
import type ExtendedPlotType from "src/plot/models/ExtendedPlotType";
import styles from "src/plot/styles/ScatterPlot.scss";

type Data = Record<string, any[]>;

const MAX_POINTS_TO_ANNOTATE = 1;

interface Props {
  data: Data;
  colorVariable: number[];
  xKey: string;
  yKey: string;
  xLabel: string;
  yLabel: string;
  // Height can be defined in pixels or set to "auto."  In auto mode, it will
  // attempt to fill the height of the viewport.
  height: number | "auto";
  density?: number[]; // For coloring by density
  margin?: any;
  plotTitle?: string;
  hoverTextKey?: string;
  continuousColorKey?: string;
  customSelectedMarkerSymbol?: string;
  selectedPoints?: Set<number>;
  onClickPoint?: (pointIndex: number) => void;
  onClickResetSelection?: () => void;
  pointVisibility?: boolean[];
  showYEqualXLine?: boolean;
  regressionLines?: any[];
  onLoad?: (plot: ExtendedPlotType) => void;
  customContinuousColorScale?: string[][];
  renderAsSvg?: boolean;
  autosize?: boolean;
  disableAnnotations?: boolean;
}

type PropsWithPlotly = Props & { Plotly: PlotlyType };

const calcPlotHeight = (plot: HTMLDivElement) => {
  if (window.innerWidth < 900) {
    return 600;
  }

  return window.innerHeight - plot.offsetTop - 22;
};

function ContextScatterPlot({
  data,
  colorVariable,
  xKey,
  yKey,
  xLabel,
  yLabel,
  height,
  continuousColorKey,
  margin = { t: 25, l: 62, r: 15 },
  customSelectedMarkerSymbol = undefined,
  plotTitle = undefined,
  hoverTextKey = undefined,
  selectedPoints = undefined,
  pointVisibility = undefined,
  showYEqualXLine = false,
  regressionLines = undefined,
  customContinuousColorScale = undefined,
  onClickPoint = () => {},
  onClickResetSelection = () => {},
  onLoad = () => {},
  density = undefined,
  renderAsSvg = false,
  disableAnnotations = false,
  autosize = undefined,
  Plotly,
}: PropsWithPlotly) {
  const ref = useRef<ExtendedPlotType>(null);
  // We save the axes of the plot so we can keep the zoom level consistent
  // between calls to Plotly#react. This value is upated
  // - When the plot is first rendered (and an autorange is calculated)
  // - After each plotly_relayout event (e.g. when the user changes the zoom
  // level).
  const axes = useRef<Partial<Layout>>({
    xaxis: undefined,
    yaxis: undefined,
  });

  function getVisibleRange(values?: number[]) {
    const min = values ? Math.min(...values) : -Infinity;
    const max = values ? Math.max(...values) : -Infinity;
    return [min - 0.2, max + 0.2];
  }

  // Use visible range to calculate extents used
  // to draw the y=x line so that Plotly's autorange
  // calculation isn't affected by drawing the y=x shape.
  const extents = useMemo(() => {
    const [minX, maxX] = getVisibleRange(
      !data
        ? undefined
        : data[xKey].filter((_, index) =>
            pointVisibility ? pointVisibility[index] : true
          )
    );
    const [minY, maxY] = getVisibleRange(
      !data
        ? undefined
        : data[yKey].filter((_, index) =>
            pointVisibility ? pointVisibility[index] : true
          )
    );

    return { minX, maxX, minY, maxY };
  }, [data, xKey, yKey, pointVisibility]);

  // On mount, we call the `onLoad` callback with a reference to the DOM node
  // (which is extended with convenience functions).
  useEffect(() => {
    if (onLoad && ref.current) {
      onLoad(ref.current);
    }
  }, [onLoad]);

  // When the columns or underlying data change, we force an autoscale by
  // discarding the stored axes.
  useEffect(() => {
    axes.current = {
      xaxis: undefined,
      yaxis: undefined,
    };
  }, [xKey, yKey, xLabel, yLabel, data]);

  // All other updates are handled by this one big effect.
  useEffect(() => {
    const plot = ref.current as ExtendedPlotType;

    const x: number[] = data[xKey];
    const y: number[] = data[yKey];
    const text = hoverTextKey ? data[hoverTextKey] : null;
    const visible = pointVisibility ?? x.map(() => true);

    const contColorData = colorVariable;

    const color = contColorData.map((c: any) =>
      c === null ? DEFAULT_PALETTE.other : c
    );

    const colorscale = customContinuousColorScale;

    const annotationText =
      text ||
      x.map((_: any, i: number) => `${x[i]?.toFixed(2)}, ${y[i]?.toFixed(2)}`);

    const lineColor = color.map((c: string | number) => {
      return typeof c === "number" ? "#aaa" : "#fff";
    });

    const getMarker = () => {
      if (density) {
        return {
          color: density,
          colorbar: {
            title: "Density (sqrt)",
            titleside: "right",
            thickness: "5px",
          },
          colorscale,
          size: 7,
          line: { color: "#000000", width: 0.5 },
          opacity: 0.8,
        };
      }

      return {
        color,
        colorscale,
        size: 7,
        line: { color: lineColor, width: 0.5 },
        opacity: selectedPoints && selectedPoints.size > 0 ? 0.8 : 1,
      };
    };

    const templateTrace = {
      type: renderAsSvg ? "scatter" : "scattergl",
      y,
      name: "",
      title: plotTitle,
      mode: "markers",
      text,
      showlegend: true,
      selectedpoints: selectedPoints ? [...selectedPoints] : [],
      marker: getMarker(),
      selected: { marker: { opacity: 1 } },
      unselected: {
        marker: {
          opacity: selectedPoints && selectedPoints.size > 0 ? 0.8 : 1,
        },
      },
    };

    console.log({ templateTrace });

    const uncoloredTace = {
      ...templateTrace,
      x: x.map((xValue: number, i: number) => {
        if (!visible[i]) {
          return null;
        }

        return color[i] === DEFAULT_PALETTE.other ? xValue : null;
      }),
    };

    const catOrContColorTrace = contColorData
      ? {
          ...templateTrace,
          x: x.map((xValue: number, i: number) => {
            if (color[i] === DEFAULT_PALETTE.other) {
              return null;
            }

            return visible[i] ? xValue : null;
          }),
        }
      : null;

    // WORKAROUND: We use a special trace to give selected points a dark
    // outline. It would be preferable to set the `line` property of
    // 'selected.marker' but Plotly does not support that. Instead,
    // we set a dark `line` on the default `marker` and then hide
    // unselected points by giving them 0 opacity.
    const selectedTrace1 = {
      ...templateTrace,
      x: uncoloredTace.x,
      marker: customSelectedMarkerSymbol
        ? {
            color,
            colorscale,
            symbol: "star-dot",
            size: 10,
            line: { color: "#000", width: 1 },
          }
        : {
            color,
            colorscale,
            size: 10,
            line: { color: "#000", width: 1 },
          },
      selected: { marker: { opacity: 1 } },
      unselected: { marker: { opacity: 0 } },
      hoverinfo: "skip",
    };

    const selectedTrace2 = {
      ...selectedTrace1,
      x: x.map((xValue: number, i: number) => {
        if (!visible[i]) {
          return null;
        }

        return color[i] === DEFAULT_PALETTE.other ? null : xValue;
      }),
    };

    const shapes: any = [];

    // TODO: Find a way to draw this in screen coodinates instead of axis
    // coodinates.
    if (showYEqualXLine) {
      const x0 = extents.minX;
      const x1 = extents.maxX;
      const y0 = x0;
      const y1 = x1;

      shapes.push({
        type: "line",
        xref: "x",
        yref: "y",
        x0,
        x1,
        y0,
        y1,
        line: { width: 1, color: "#444", dash: "dot" },
      });
    }

    if (regressionLines) {
      regressionLines.forEach((line: any) => {
        if (line.hidden) {
          return;
        }

        const x0 = extents.minX;
        const x1 = extents.maxX;
        const y0 = line.m * x0 + line.b;
        const y1 = line.m * x1 + line.b;

        shapes.push({
          layer: "below",
          type: "line",
          xref: "x",
          yref: "y",
          xanchor: 2,
          yanchor: 2,
          x0,
          x1,
          y0,
          y1,
          line: {
            width: 1,
            color: line.color,
          },
        });
      });
    }

    const plotlyData: any[] = [
      uncoloredTace,
      catOrContColorTrace,
      selectedTrace1,
      selectedTrace2,
    ].filter(Boolean);

    // Restore or initialize axes. We set `autorange` to true on the first render
    // so that Plotly can calculate the extents of the plot for us.
    const xaxis = axes.current.xaxis || {
      title: xLabel,
      exponentformat: "e",
      type: "linear",
      autorange: true,
    };

    const yaxis = axes.current.yaxis || {
      title: yLabel,
      exponentformat: "e",
      autorange: true,
    };

    const layout: Partial<Layout> = {
      uirevision: "true",
      autosize,
      shapes,
      height: height === "auto" ? calcPlotHeight(plot) : height,
      margin,
      hovermode: "closest",
      hoverlabel: {
        namelength: -1,
      },

      // We hide the legend because the traces don't have names and the second
      // one is only use to render a single highlighted point. Labeling them
      // would only cause confusion.
      showlegend: false,

      xaxis,
      yaxis,

      annotations: disableAnnotations
        ? undefined
        : selectedPoints && selectedPoints.size <= MAX_POINTS_TO_ANNOTATE
        ? [...selectedPoints]
            .filter(
              // Filter out any annotations associated with missing data. This can
              // happen if the x or y column has changed since the annotations were
              // created.
              (pointIndex) =>
                typeof x[pointIndex] === "number" &&
                typeof y[pointIndex] === "number"
            )
            .map((pointIndex) => ({
              x: x[pointIndex],
              y: y[pointIndex],
              text: annotationText[pointIndex],
              visible: visible[pointIndex],
              xref: "x",
              yref: "y",
              arrowhead: 0,
              standoff: 4,
              arrowcolor: "#888",
              bordercolor: "#c7c7c7",
              bgcolor: "#fff",
              pointIndex,
            }))
        : (() => {
            return selectedPoints
              ? [
                  {
                    text: `(${selectedPoints.size} selected points)`,
                    arrowcolor: "transparent",
                    bordercolor: "#c7c7c7",
                    bgcolor: "#fff",
                  },
                ]
              : undefined;
          })(),
    };

    const config: Partial<Config> = {
      // Automatically resizes the plot when the window is resized.
      responsive: true,
      // Allows the user to move annotations (but just the tail and not the
      // whole thing).
      edits: { annotationTail: true },
    };

    if (renderAsSvg) {
      Plotly.react(plot, plotlyData, layout, { staticPlot: true });
    } else {
      Plotly.react(plot, plotlyData, layout, config);
    }

    // Keep track of added listeners so we can easily remove them.
    const listeners: [string, (e: any) => void][] = [];

    const on = (eventName: string, callback: (e: any) => void) => {
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

    // Add a few non-standard methods to the plot for convenience.
    plot.setDragmode = (dragmode) => {
      setTimeout(() => {
        Plotly.update(plot, { selectedpoints: [] }, { dragmode });
        // This redraw fixes a very strange bug where setting the drag mode to
        // select (or lasso) with a filter also applied causes all of the points
        // to disappear.
        Plotly.redraw(plot);
      }, 0);
    };

    plot.zoomIn = () => setTimeout(zoom, 0, "in");
    plot.zoomOut = () => setTimeout(zoom, 0, "out");

    plot.resetZoom = () => {
      const nextLayout = { ...plot.layout };
      (plot.layout.shapes as any) = undefined;
      zoom("reset");
      Plotly.react(plot, plot.data, nextLayout, plot.config);
    };

    on("plotly_click", (e: PlotMouseEvent) => {
      const { pointIndex } = e.points[0];

      if (onClickPoint) {
        onClickPoint(pointIndex);
      }
    });

    on("plotly_selecting", () => {
      if (selectedPoints && selectedPoints.size > 0) {
        onClickResetSelection();
      }
    });

    on("plotly_deselect", () => {
      onClickResetSelection();
    });

    // WORKAROUND: Double-click is supposed to reset the zoom but it only works
    // actually intermittently so we'll do it ourselves.
    on("plotly_doubleclick", () => {
      plot.resetZoom();
    });

    // WORKAROUND: For some reason, autosize only works
    // with width so we'll calculate the height as well.
    on("plotly_autosize", () => {
      setTimeout(() => {
        plot.layout.height = height === "auto" ? calcPlotHeight(plot) : height;
        Plotly.redraw(plot);
      });
    });

    // https://github.com/plotly/plotly.js/blob/55dda47/src/lib/prepare_regl.js
    on("plotly_webglcontextlost", () => {
      // Fixes a bug where points disappear after the browser has been left
      // idle for some time.
      Plotly.redraw(plot);
    });

    // After initializing the plot with `autorange` set to true, store what
    // Plotly calculated for the axes zoom level and turn off autorange.
    on("plotly_afterplot", () => {
      if (!axes.current.xaxis || !axes.current.yaxis) {
        axes.current = {
          xaxis: { ...plot.layout.xaxis },
          yaxis: { ...plot.layout.yaxis },
        };
      }
    });

    return () => {
      listeners.forEach(([eventName, callback]) =>
        plot.removeListener(eventName, callback)
      );
    };
  }, [
    data,
    colorVariable,
    xKey,
    yKey,
    continuousColorKey,
    xLabel,
    yLabel,
    plotTitle,
    hoverTextKey,
    height,
    selectedPoints,
    customContinuousColorScale,
    onClickPoint,
    onClickResetSelection,
    pointVisibility,
    extents,
    showYEqualXLine,
    regressionLines,
    customSelectedMarkerSymbol,
    renderAsSvg,
    disableAnnotations,
    density,
    margin,
    autosize,
    Plotly,
  ]);

  return <div className={styles.ScatterPlot} ref={ref} />;
}
/* eslint-disable prefer-arrow-callback */
export default React.memo(function LazyContextScatterPlot({
  data,
  ...otherProps
}: Props) {
  return (
    <PlotlyLoader version="module">
      {(Plotly: PlotlyType) =>
        data ? (
          <ContextScatterPlot
            data={data}
            Plotly={Plotly}
            // eslint-disable-next-line react/jsx-props-no-spreading
            {...otherProps}
          />
        ) : null
      }
    </PlotlyLoader>
  );
});
/* eslint-enable prefer-arrow-callback */
