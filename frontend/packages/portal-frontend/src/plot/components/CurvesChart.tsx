import {
  Layout,
  Margin,
  PlotData,
  PlotlyHTMLElement,
  PlotMouseEvent,
} from "plotly.js";
import React, { useEffect, useRef } from "react";
import ExtendedPlotType from "../models/ExtendedPlotType";
import PlotlyLoader, { PlotlyType } from "./PlotlyLoader";

export interface CurvesChartProps {
  curveTraces: any;
  title: string;
  yAxisTitle: string;
  xAxisTitle: string;
  dottedLine: number;
  minX: number;
  maxX: number;
  showLegend: boolean;
  onLoad: (plot: ExtendedPlotType) => void;
  height?: number | "auto";
  margin?: Margin;
  customWidth?: number | undefined;
  xRange?: number[] | undefined;
  selectedCurves?: Set<string>;
  customHoverinfo?: PlotData["hoverinfo"];
  onClickCurve?: (id: string) => void;
  onMultiselect?: (pointIndices: number[]) => void;
  onClickResetSelection?: () => void;
  xAxisFontSize?: number;
  yAxisFontSize?: number;
}

const findIndexByProperty = (
  array: any[],
  property: keyof any,
  value: any
): number => {
  return array.findIndex((item) => item[property] === value);
};

const calcPlotHeight = (plot: HTMLDivElement) => {
  const fullHeight = window.innerHeight - plot.offsetTop - 26;
  return Math.min(plot.offsetWidth * 0.8, fullHeight);
};

type CurvesChartWithPlotly = CurvesChartProps & { Plotly: PlotlyType };

function CurvesChart({
  title,
  yAxisTitle,
  xAxisTitle,
  dottedLine,
  minX,
  maxX,
  showLegend,
  curveTraces,
  customHoverinfo = undefined,
  selectedCurves = undefined,
  onLoad = () => {},
  onClickCurve = undefined,
  onMultiselect = () => {},
  onClickResetSelection = () => {},
  height = "auto",
  customWidth = undefined,
  xRange = undefined,
  xAxisFontSize = 14,
  yAxisFontSize = 14,
  margin = {
    l: 80,

    r: 40,

    b: 35,

    t: 15,

    pad: 0,
  },
  Plotly,
}: CurvesChartWithPlotly) {
  const ref = useRef<ExtendedPlotType>(null);

  const axes = useRef<Partial<Layout>>({
    xaxis: undefined,
    yaxis: undefined,
  });

  // When the columns or underlying data change, we force an autoscale by
  // discarding the stored axes.
  useEffect(() => {
    axes.current = {
      xaxis: undefined,
      yaxis: undefined,
    };
  }, [curveTraces]);

  // Update axes when font size changes.
  useEffect(() => {
    const xaxis = axes.current.xaxis;
    const yaxis = axes.current.yaxis;

    if (xaxis) {
      xaxis.title = {
        ...(xaxis.title as object),
        font: { size: xAxisFontSize },
      };
    }

    if (yaxis) {
      yaxis.title = {
        ...(yaxis.title as object),
        font: { size: yAxisFontSize },
      };
    }
  }, [xAxisFontSize, yAxisFontSize]);

  useEffect(() => {
    if (onLoad && ref.current) {
      onLoad(ref.current);
    }
  }, [onLoad]);

  useEffect(() => {
    const plot = ref.current as ExtendedPlotType;

    const xAxisTemplate: Partial<Plotly.LayoutAxis> = {
      visible: true,
      type: "log",
      dtick: 1,
      title: {
        text: xAxisTitle,
        font: {
          size: 12,
        },
      },
    };

    const yAxisTemplate: Partial<Plotly.LayoutAxis> = {
      visible: true,
      rangemode: "tozero",
      title: {
        text: yAxisTitle,
        font: {
          size: 12,
        },
      },
    };

    const layout: Partial<Plotly.Layout> = {
      title,

      xaxis: xAxisTemplate,

      shapes: [
        {
          x0: minX,
          y0: dottedLine,
          x1: maxX,
          y1: dottedLine,
          type: "line",
          yref: "paper",
          line: {
            color: "#D9D9D9",
            dash: "dot",
            width: 1,
          },
        },
      ],

      yaxis: yAxisTemplate,

      autosize: true,

      dragmode: false,

      showlegend: showLegend,

      height: height === "auto" ? calcPlotHeight(plot) : height,

      margin,
    };

    const config: Partial<Plotly.Config> = { responsive: true };

    Plotly.newPlot(plot, curveTraces, layout, config);

    if (selectedCurves && selectedCurves.size > 0) {
      const prevSelections =
        [...selectedCurves].map((modelId: string) => {
          return findIndexByProperty(curveTraces, "id", modelId);
        }) || [];

      Plotly.restyle(
        plot,
        {
          line: { color: "rgba(60, 8, 128, 1)", width: 3 },
        },
        prevSelections
      );
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

    // Add a downloadImage method to the plot for PNG and SVG export using Plotly's toImage utility
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

    on("plotly_hover", (e: PlotMouseEvent) => {
      const { curveNumber } = e.points[0];
      Plotly.restyle(
        plot,
        {
          line: { color: "rgba(60, 8, 128, 1)", width: 3 },
        },
        [curveNumber]
      );
    });

    on("plotly_unhover", (e: PlotMouseEvent) => {
      const { curveNumber } = e.points[0];
      const curveId = curveTraces[curveNumber].id;

      // If the user clicked the line, we want to persist the change in coloring
      if (!selectedCurves?.has(curveId)) {
        Plotly.restyle(
          plot,
          {
            line: { color: "rgba(108, 122, 137, 0.5)" },
          },
          [curveNumber]
        );
      }
    });

    on("plotly_click", (e: PlotMouseEvent) => {
      const { curveNumber } = e.points[0];
      const curveId = curveTraces[curveNumber].id;

      if (onClickCurve) {
        Plotly.restyle(
          plot,
          {
            line: { color: "rgba(60, 8, 128, 1)", width: 3 },
          },
          [curveNumber]
        );

        onClickCurve(curveId);
      }
    });

    on("plotly_selecting", () => {
      if (selectedCurves && selectedCurves.size > 0) {
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

    return () => {
      listeners.forEach(([eventName, callback]) =>
        plot.removeListener(eventName, callback)
      );
    };
  }, [
    Plotly,
    showLegend,
    height,
    margin,
    curveTraces,
    customWidth,
    xRange,
    title,
    yAxisTitle,
    xAxisTitle,
    dottedLine,
    minX,
    maxX,
    onClickCurve,
    onClickResetSelection,
    onMultiselect,
    selectedCurves,
    customHoverinfo,
  ]);

  return <div ref={ref} />;
}

export default function LazyLineChart({
  title,
  curveTraces,
  ...otherProps
}: CurvesChartProps) {
  return (
    <PlotlyLoader version="module">
      {(Plotly) =>
        curveTraces ? (
          <CurvesChart
            title={title}
            curveTraces={curveTraces}
            Plotly={Plotly}
            // eslint-disable-next-line react/jsx-props-no-spreading
            {...otherProps}
          />
        ) : null
      }
    </PlotlyLoader>
  );
}
