/* eslint-disable react/require-default-props */
import React, { useEffect, useRef, useState } from "react";
import type {
  Config,
  Data as PlotlyData,
  Layout,
  PlotlyHTMLElement,
  PlotMouseEvent,
} from "plotly.js";
import { colorPalette } from "depmap-shared";
import PlotlyLoader, { PlotlyType } from "src/plot/components/PlotlyLoader";
import type ExtendedPlotType from "src/plot/models/ExtendedPlotType";
import styles from "src/plot/styles/ScatterPlot.scss";

type Data = Record<string, any[]>;

interface Props {
  data: Data | null;
  xKey: string;
  yKey: string;
  xLabel: string;
  yLabel: string;
  // Height can be defined in pixels or set to "auto."  In auto mode, it will
  // attempt to fill the height of the viewport.
  height: number | "auto";
  // If defined, the corresponding key from `data` will used to generate hover
  // text.
  hoverTextKey?: string | undefined | null;
  // Allows you to specify which key of `data` should be used to label annotations.
  // If this is not defined, it will try to use `hoverTextKey` instead. If that's
  // not defined, it will use (x, y) values to annotate points.
  annotationKey?: string | undefined | null;
  highlightPoint?: number | undefined | null;
  onClickPoint?: (pointIndex: number) => void;
  pointVisibility?: boolean[] | undefined | null;
  onLoad?: (plot: ExtendedPlotType) => void;
}

type PropsWithPlotly = Props & { data: Data; Plotly: PlotlyType };

export const calcPlotHeight = (plot: HTMLDivElement) => {
  const fullHeight = window.innerHeight - plot.offsetTop - 26;
  return Math.min(plot.offsetWidth * 0.7, fullHeight);
};

function ScatterPlot({
  data,
  xKey,
  yKey,
  xLabel,
  yLabel,
  height,
  hoverTextKey = null,
  annotationKey = null,
  highlightPoint = null,
  pointVisibility = null,
  onClickPoint = () => {},
  onLoad = () => {},
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

  // We store the indexes of all the points the user has labeled as well any
  // changes made to their arrowhead positions.
  const [annotations, setAnnotations] = useState<number[]>([]);
  const annotationTails = useRef<Record<string, { ax: number; ay: number }>>(
    {}
  );

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

    const type: any = "scattergl";
    const x = data[xKey];
    const y = data[yKey];
    const text = hoverTextKey ? data[hoverTextKey] : null;
    const visible = pointVisibility ?? x.map(() => true);

    const annotationText =
      (annotationKey && data[annotationKey]) ||
      text ||
      x.map((_, i) => `${x[i]?.toFixed(2)}, ${y[i]?.toFixed(2)}`);

    const hp =
      highlightPoint !== null && visible[highlightPoint]
        ? highlightPoint
        : null;

    const plotlyData: PlotlyData[] = [
      {
        type,
        name: "",
        mode: "markers",
        // HACK: We hide points by setting their x coordinate to null. This
        // technique is more performant than using a filter transform.
        x: x.map((xValue, i) =>
          visible[i] && i !== highlightPoint ? xValue : null
        ),
        y,
        text,
        marker: {
          color: colorPalette.interesting_color,
          line: { color: "#fff", width: 0.4 },
        },
      },
      // We use a seecond trace to render a single highlighted point. This
      // ensures it's rendered on top.
      {
        type,
        name: "",
        mode: "markers",
        x: hp !== null ? [x[hp]] : [],
        y: hp !== null ? [y[hp]] : [],
        text: hp !== null && text ? [text[hp]] : [],
        marker: { color: colorPalette.selected_color, size: 16 },
      },
    ];

    const layout: Partial<Layout> = {
      height: height === "auto" ? calcPlotHeight(plot) : height,
      margin: { t: 30, l: 80, r: 30 },
      hovermode: "closest",

      // We hide the legend because the traces don't have names and the second
      // one is only use to render a single highlighted point. Labeling them
      // would only cause confusion.
      showlegend: false,

      // Restore or initialize axes. We set `autorange` to true on the first render
      // so that Plotly can calculate the extents of the plot for us.
      xaxis: axes.current.xaxis || {
        title: xLabel,
        exponentformat: "e",
        autorange: true,
      },
      yaxis: axes.current.yaxis || {
        title: yLabel,
        exponentformat: "e",
        autorange: true,
      },

      // Preserve the existing dragmode if present.
      dragmode: plot?.layout?.dragmode || "zoom",

      annotations: annotations
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
          pointIndex,
          // Restore any annotation arrowhead positions the user may have edited.
          ax: annotationTails.current[`${xKey}-${yKey}-${pointIndex}`]?.ax,
          ay: annotationTails.current[`${xKey}-${yKey}-${pointIndex}`]?.ay,
        })),
    };

    const config: Partial<Config> = {
      // Automatically resizes the plot when the window is resized.
      responsive: true,

      // Allows the user to move annotations (but just the tail and not the
      // whole thing).
      edits: { annotationTail: true },
    };

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

    // HACK: The zoom functions provided by Plotly's modebar aren't exposed
    // by its API. The only way to trigger them is by actually clicking the
    // buttons 😕
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

    // After initializing the plot with `autorange` set to true, store what
    // Plotly calculated for the axes zoom level and turn off autorange.
    on("plotly_afterplot", () => {
      if (!axes.current.xaxis || !axes.current.yaxis) {
        axes.current = {
          xaxis: { ...plot.layout.xaxis, autorange: false },
          yaxis: { ...plot.layout.yaxis, autorange: false },
        };
      }
    });

    on("plotly_relayout", () => {
      axes.current = {
        xaxis: { ...plot.layout.xaxis, autorange: false },
        yaxis: { ...plot.layout.yaxis, autorange: false },
      };

      plot.layout.annotations.forEach((annotation) => {
        const { ax, ay } = annotation;
        const { pointIndex } = annotation as any;

        if (ax && ay) {
          annotationTails.current[`${xKey}-${yKey}-${pointIndex}`] = { ax, ay };
        }
      });
    });

    on("plotly_click", (e: PlotMouseEvent) => {
      const { curveNumber, pointIndex } = e.points[0];

      // Curve #1 is the special trace that only has one highlighted point.
      // `pointIndex` will always be 0 in that case which isn't useful (it
      // doesn't correlate with the supplied `data`).
      const index = curveNumber === 1 ? highlightPoint : pointIndex;

      if (index == null) {
        return;
      }

      if (!e.event.shiftKey) {
        onClickPoint(index);
      } else {
        setAnnotations((prev) => {
          const existing = prev.find((a) => a === index);

          return existing
            ? prev.filter((a) => a !== existing)
            : prev.concat(index);
        });
      }
    });

    // WORKAROUND: Double-click is supposed to reset the zoom but it only works
    // actually intermittently so we'll do it ourselves.
    on("plotly_doubleclick", () => plot.resetZoom());

    // WORKAROUND: For some reason, autosize only works
    // with width so we'll calculate the height as well.
    on("plotly_autosize", () => {
      setTimeout(() => {
        plot.layout.height = height === "auto" ? calcPlotHeight(plot) : height;
        Plotly.redraw(plot);
      });
    });

    // Add a few non-standard methods to the plot for convenience.
    plot.setDragmode = (dragmode) => {
      setTimeout(() => {
        Plotly.update(plot, { selectedpoints: null }, { dragmode });
        // This redraw fixes a very strange bug where setting the drag mode to
        // select (or lasso) with a filter also applied causes all of the points
        // to disappear.
        Plotly.redraw(plot);
      }, 0);
    };

    plot.zoomIn = () => setTimeout(zoom, 0, "in");
    plot.zoomOut = () => setTimeout(zoom, 0, "out");
    plot.resetZoom = () => setTimeout(zoom, 0, "reset");
    plot.downloadImage = (options) => Plotly.downloadImage(plot, options);

    plot.annotateSelected = () => {
      let points = plot.data[0].selectedpoints as number[];

      if (points) {
        if (points.length > 500) {
          window.console.warn("Too many points! Limiting selection to 500.");
          points = points.slice(0, 500);
        }

        setAnnotations((xs) => Array.from(new Set(xs.concat(points))));
      }
    };

    plot.removeAnnotations = () => {
      setAnnotations([]);
    };

    plot.isPointInView = (pointIndex: number) => {
      const px = x[pointIndex] as number;
      const py = y[pointIndex] as number;
      const xrange = plot.layout.xaxis.range as [number, number];
      const yrange = plot.layout.yaxis.range as [number, number];

      return (
        px >= xrange[0] && px <= xrange[1] && py >= yrange[0] && py <= yrange[1]
      );
    };

    plot.xValueMissing = (pointIndex: number) => {
      return typeof data[xKey][pointIndex] !== "number";
    };

    plot.yValueMissing = (pointIndex: number) => {
      return typeof data[yKey][pointIndex] !== "number";
    };

    return () => {
      listeners.forEach(([eventName, callback]) =>
        plot.removeListener(eventName, callback)
      );
    };
  }, [
    data,
    xKey,
    yKey,
    xLabel,
    yLabel,
    height,
    hoverTextKey,
    annotationKey,
    highlightPoint,
    onClickPoint,
    annotations,
    pointVisibility,
    Plotly,
  ]);

  return <div className={styles.ScatterPlot} ref={ref} />;
}

export default function LazyScatterPlot({ data, ...otherProps }: Props) {
  return (
    <PlotlyLoader version="module">
      {(Plotly: PlotlyType) =>
        data ? (
          // eslint-disable-next-line react/jsx-props-no-spreading
          <ScatterPlot data={data} Plotly={Plotly} {...otherProps} />
        ) : null
      }
    </PlotlyLoader>
  );
}
