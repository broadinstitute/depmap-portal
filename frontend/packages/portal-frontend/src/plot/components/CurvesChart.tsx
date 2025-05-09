import { Margin } from "plotly.js";
import React, { useEffect, useRef } from "react";
import ExtendedPlotType from "../models/ExtendedPlotType";
import PlotlyLoader, { PlotlyType } from "./PlotlyLoader";

export interface CurvesChartProps {
  title: string;
  yAxisTitle: string;
  xAxisTitle: string;
  curves: any;
  dottedLine: number;
  minX: number;
  maxX: number;
  showLegend: boolean;
  onLoad: (plot: ExtendedPlotType) => void;
  height?: number | "auto";
  margin?: Margin;
  customWidth?: number | undefined;
  xRange?: number[] | undefined;
}

const calcPlotHeight = (plot: HTMLDivElement) => {
  const fullHeight = window.innerHeight - plot.offsetTop - 26;
  return Math.min(plot.offsetWidth * 0.8, fullHeight);
};

type CurvesChartWithPlotly = CurvesChartProps & { Plotly: PlotlyType };

function CurvesChart({
  title,
  yAxisTitle,
  xAxisTitle,
  curves,
  dottedLine,
  minX,
  maxX,
  showLegend,
  onLoad = () => {},
  height = "auto",
  customWidth = undefined,
  xRange = undefined,
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

    Plotly.newPlot(plot, curves, layout, config);
  }, [
    Plotly,
    showLegend,
    height,
    margin,
    curves,
    customWidth,
    xRange,
    title,
    yAxisTitle,
    xAxisTitle,
    dottedLine,
    minX,
    maxX,
  ]);

  return <div ref={ref} />;
}

export default function LazyLineChart({
  title,
  curves,
  ...otherProps
}: CurvesChartProps) {
  return (
    <PlotlyLoader version="module">
      {(Plotly) =>
        curves ? (
          <CurvesChart
            title={title}
            curves={curves}
            Plotly={Plotly}
            // eslint-disable-next-line react/jsx-props-no-spreading
            {...otherProps}
          />
        ) : null
      }
    </PlotlyLoader>
  );
}
