import { Margin } from "plotly.js";
import React, { useEffect, useRef } from "react";
import ExtendedPlotType from "../models/ExtendedPlotType";
import PlotlyLoader, { PlotlyType } from "./PlotlyLoader";

export interface BarChartProps {
  title: string;
  xValues: number[];
  yValues: string[];
  onLoad: (plot: ExtendedPlotType) => void;
  customColors: string[];
  height?: number;
  margin?: Margin;
  customWidth?: number | undefined;
}

type BarChartWithPlotly = BarChartProps & { Plotly: PlotlyType };

function BarChart({
  title,
  xValues,
  yValues,
  customColors,
  onLoad = () => {},
  height = 450,
  customWidth = undefined,
  margin = {
    l: 300,

    r: 20,

    b: 70,

    t: 0,

    pad: 0,
  },
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

    const test: any = xValues.map((xVal: number, index: number) => {
      return {
        x: [xVal],
        y: [yValues[index]],
        type: "bar",
        marker: { color: customColors[index] },
        orientation: "h",
      };
    });

    const xAxisTemplate: Partial<Plotly.LayoutAxis> = {
      visible: true,
      autorange: true,
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

      height,

      margin,
    };

    const config: Partial<Plotly.Config> = { responsive: true };

    Plotly.newPlot(plot, test, layout, config);
  }, [Plotly, xValues, yValues, height, margin, customWidth]);

  return <div ref={ref} />;
}

export default function LazyBarChart({
  title,
  xValues,
  yValues,
  customColors,
  ...otherProps
}: BarChartProps) {
  return (
    <PlotlyLoader version="module">
      {(Plotly) =>
        xValues && yValues ? (
          <BarChart
            title={title}
            xValues={xValues}
            yValues={yValues}
            customColors={customColors}
            Plotly={Plotly}
            // eslint-disable-next-line react/jsx-props-no-spreading
            {...otherProps}
          />
        ) : null
      }
    </PlotlyLoader>
  );
}
