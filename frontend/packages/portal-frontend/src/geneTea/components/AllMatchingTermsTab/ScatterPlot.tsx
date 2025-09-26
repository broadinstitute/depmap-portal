/* eslint-disable react/require-default-props */
import React, { useEffect, useRef } from "react";
import type {
  Config,
  Data as PlotlyData,
  Layout,
  PlotlyHTMLElement,
  PlotMouseEvent,
} from "plotly.js";
import PlotlyLoader, { PlotlyType } from "src/plot/components/PlotlyLoader";
import type ExtendedPlotType from "src/plot/models/ExtendedPlotType";
import styles from "src/plot/styles/ScatterPlot.scss";

interface Props {
  data: {
    stopwords: {
      indexLabels: string[];
      x: number[];
      y: number[];
      customdata: string[];
    };
    otherTerms: {
      indexLabels: string[];
      x: number[];
      y: number[];
      customdata: string[];
    };
    selectedTerms: {
      indexLabels: string[];
      x: number[];
      y: number[];
      customdata: string[];
    };
  };

  xLabel: string;
  yLabel: string;
  // Height can be defined in pixels or set to "auto."  In auto mode, it will
  // attempt to fill the height of the viewport.
  height: number | "auto";
  onClickPoint?: (selections: Set<string>, shiftKey: boolean) => void;
  onLoad?: (plot: ExtendedPlotType) => void;
}

type PropsWithPlotly = Props & { Plotly: PlotlyType };

export const calcPlotHeight = (plot: HTMLDivElement) => {
  const fullHeight = window.innerHeight - plot.offsetTop - 26;
  return Math.min(plot.offsetWidth * 0.7, fullHeight);
};

function ScatterPlot({
  data,
  xLabel,
  yLabel,
  height,
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
  }, [xLabel, yLabel, data]);

  // All other updates are handled by this one big effect.
  useEffect(() => {
    const plot = ref.current as ExtendedPlotType;

    const type: any = "scattergl";

    // TODO move this out of the ScatterPlot component so that this component can take any
    // list of PlotlyData with colors and titles defined per trace as a prop.
    const stopwordsData: PlotlyData = {
      type,
      name: "stopwords",
      mode: "markers",
      x: data.stopwords.x,
      y: data.stopwords.y as any,
      hovertemplate: "%{customdata}<extra></extra>",
      marker: {
        color: "rgb(156, 168, 166)",
      },
    };

    const otherTermsData: PlotlyData = {
      type,
      name: "Other Terms",
      mode: "markers",
      x: data.otherTerms.x,
      y: data.otherTerms.y as any,
      hovertemplate: "%{customdata}<extra></extra>",
      marker: {
        color: "rgb(225, 190, 106)",
      },
    };

    const selectedTermsData: PlotlyData = {
      type,
      name: "Selected Terms",
      mode: "markers",
      x: data.selectedTerms.x,
      y: data.selectedTerms.y as any,
      hovertemplate: "%{customdata}<extra></extra>",
      marker: {
        color: "red",
      },
    };

    const plotlyData: PlotlyData[] = [
      stopwordsData,
      otherTermsData,
      selectedTermsData,
    ];

    const layout: Partial<Layout> = {
      height: height === "auto" ? calcPlotHeight(plot) : height,
      margin: { t: 30, l: 80, r: 30 },
      hovermode: "closest",
      showlegend: true,

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
    });

    on("plotly_click", (e: PlotMouseEvent) => {
      const { pointIndex, curveNumber } = e.points[0];
      const anyModifier = e.event.shiftKey;

      let indexLabel;
      if (curveNumber === 0) {
        indexLabel = data.stopwords.indexLabels[pointIndex];
      } else if (curveNumber === 1) {
        indexLabel = data.otherTerms.indexLabels[pointIndex];
      } else if (curveNumber === 2) {
        indexLabel = data.selectedTerms.indexLabels[pointIndex];
      }

      // TODO update this to handle shift click multi select
      if (onClickPoint && indexLabel !== undefined) {
        onClickPoint(new Set([indexLabel]), anyModifier);
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

    return () => {
      listeners.forEach(([eventName, callback]) =>
        plot.removeListener(eventName, callback)
      );
    };
  }, [data, xLabel, yLabel, height, onClickPoint, Plotly]);

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
