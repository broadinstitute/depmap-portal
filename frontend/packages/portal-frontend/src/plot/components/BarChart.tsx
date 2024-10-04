import { Margin } from "plotly.js";
import React, { useEffect, useRef } from "react";
import ExtendedPlotType from "../models/ExtendedPlotType";
import PlotlyLoader, { PlotlyType } from "./PlotlyLoader";

export interface BarChartProps {
  title: string;
  categoryLabels: string[];
  categoryValues: number[];
  onLoad: (plot: ExtendedPlotType) => void;
  customColors: string[];
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
  categoryLabels,
  categoryValues,
  customColors,
  onLoad = () => {},
  height = "auto",
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

    const test: any = categoryValues.map((xVal: number, index: number) => {
      return {
        x: orientation === "v" ? [categoryLabels[index]] : [xVal],
        y: orientation === "v" ? [xVal] : [categoryLabels[index]],
        type: "bar",
        marker: { color: customColors[index] },
        hoverinfo: "x+y",
        orientation,
      };
    });

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

      height: height === "auto" ? calcPlotHeight(plot, true) : height,

      margin,
    };

    const config: Partial<Plotly.Config> = { responsive: true };

    Plotly.newPlot(plot, test, layout, config);
  }, [
    Plotly,
    categoryValues,
    categoryLabels,
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
  categoryValues,
  categoryLabels,
  customColors,
  customLegend = undefined,
  ...otherProps
}: BarChartProps) {
  return (
    <PlotlyLoader version="module">
      {(Plotly) =>
        categoryValues && categoryLabels ? (
          <>
            <BarChart
              title={title}
              categoryValues={categoryValues}
              categoryLabels={categoryLabels}
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
