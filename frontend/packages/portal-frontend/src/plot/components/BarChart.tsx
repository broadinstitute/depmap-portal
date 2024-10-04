import { Margin } from "plotly.js";
import React, { useEffect, useRef } from "react";
import ExtendedPlotType from "../models/ExtendedPlotType";
import PlotlyLoader, { PlotlyType } from "./PlotlyLoader";

export interface BarChartProps {
  title: string;
  data: any;
  onLoad: (plot: ExtendedPlotType) => void;
  customColors: string[][];
  barmode?: "stack" | "group" | "overlay" | "relative" | undefined;
  xAxisTitle?: string;
  height?: "auto" | number;
  margin?: Margin;
  customWidth?: number | undefined;
  orientation?: string;
  customLegend?: React.JSX.Element;
}

type BarChartWithPlotly = BarChartProps & { Plotly: PlotlyType };

const calcPlotHeight = (plot: HTMLDivElement, includeCustomLegend: boolean) => {
  const legendOffeset = includeCustomLegend ? 80 : 0;
  const fullHeight = window.innerHeight - plot.offsetTop - 26 - legendOffeset;
  const calculatedHeight = Math.min(
    plot.offsetWidth * 0.8 - legendOffeset,
    fullHeight
  );

  return calculatedHeight;
};

function BarChart({
  title,
  data,
  customColors,
  onLoad = () => {},
  height = "auto",
  barmode = undefined,
  customWidth = undefined,
  xAxisTitle = undefined,
  orientation = "h",
  margin = {
    l: 325,

    r: 20,

    b: 60,

    t: 0,

    pad: 0,
  },
  customLegend = undefined,
  Plotly,
}: BarChartWithPlotly) {
  const ref = useRef<ExtendedPlotType>(null);

  useEffect(() => {
    if (onLoad && ref.current) {
      onLoad(ref.current);
    }
  }, [onLoad]);

  useEffect(() => {
    const plot = ref.current as ExtendedPlotType;

    // console.log({ data2 });

    // var trace1 = {
    //   x: ["giraffes", "orangutans", "monkeys"],

    //   y: [20, 14, 23],

    //   name: "SF Zoo",

    //   type: "bar",
    // };

    // var trace2 = {
    //   x: ["giraffes", "orangutans", "monkeys"],

    //   y: [12, 18, 29],

    //   name: "LA Zoo",

    //   type: "bar",
    // };

    // const data: any = [trace1, trace2];
    console.log({ data });

    // const layout: Partial<Plotly.Layout> = { barmode: "stack" };

    const xAxisTemplate: Partial<Plotly.LayoutAxis> = {
      visible: true,
      autorange: true,
      title: xAxisTitle,
    };

    const yAxisTemplate: Partial<Plotly.LayoutAxis> = {
      visible: true,
      autorange: true,
    };

    const layout: Partial<Plotly.Layout> = {
      title,
      showlegend: false,

      xaxis: xAxisTemplate,

      yaxis: yAxisTemplate,

      autosize: true,

      dragmode: false,
      bargap: 0.1,
      barmode,

      height: height === "auto" ? calcPlotHeight(plot, true) : height,

      margin,
    };

    const config: Partial<Plotly.Config> = { responsive: true };

    Plotly.newPlot(plot, data, layout, config);
  }, [
    Plotly,
    data,
    ,
    height,
    margin,
    customWidth,
    orientation,
    customColors,
    xAxisTitle,
    customLegend,
    title,
  ]);

  return <div ref={ref} />;
}

export default function LazyBarChart({
  title,
  data,
  customColors,
  customLegend = undefined,
  ...otherProps
}: BarChartProps) {
  return (
    <PlotlyLoader version="module">
      {(Plotly) =>
        data ? (
          <>
            <BarChart
              title={title}
              data={data}
              customColors={customColors}
              Plotly={Plotly}
              // eslint-disable-next-line react/jsx-props-no-spreading
              {...otherProps}
            />
            {customLegend || null}
          </>
        ) : null
      }
    </PlotlyLoader>
  );
}
