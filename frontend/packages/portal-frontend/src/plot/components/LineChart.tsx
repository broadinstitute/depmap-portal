import { Margin } from "plotly.js";
import React, { useEffect, useRef } from "react";
import ExtendedPlotType from "../models/ExtendedPlotType";
import PlotlyLoader, { PlotlyType } from "./PlotlyLoader";

export interface LineChartProps {
  title: string;
  yAxisTitle: string;
  xLabels: string[];
  yValues: number[];
  text: string[];
  onLoad: (plot: ExtendedPlotType) => void;
  height?: number;
  margin?: Margin;
  customWidth?: number | undefined;
}

type LineChartWithPlotly = LineChartProps & { Plotly: PlotlyType };

function LineChart({
  title,
  yAxisTitle,
  xLabels,
  yValues,
  text,
  onLoad = () => {},
  height = 450,
  customWidth = undefined,
  margin = {
    l: 65,

    r: 20,

    b: 90,

    t: 45,

    pad: 0,
  },
  Plotly,
}: LineChartWithPlotly) {
  const ref = useRef<ExtendedPlotType>(null);

  useEffect(() => {
    if (onLoad && ref.current) {
      onLoad(ref.current);
    }
  }, [onLoad]);

  useEffect(() => {
    const plot = ref.current as ExtendedPlotType;
    const data: any = [
      {
        x: xLabels,
        y: yValues,
        hovertemplate: "<b>%{text}</b><extra></extra>",
        text,
        type: "lines",
      },
    ];

    const xAxisTemplate: Partial<Plotly.LayoutAxis> = {
      visible: true,
      autorange: true,
    };

    const yAxisTemplate: Partial<Plotly.LayoutAxis> = {
      visible: true,
      autorange: true,

      // Type MUST be explicitly stated. Without this, plotly thinks
      // y is also categorical will plot the y numbers as if they were strings.
      type: "linear",
      title: yAxisTitle,
    };

    const layout: Partial<Plotly.Layout> = {
      title,

      xaxis: xAxisTemplate,

      yaxis: yAxisTemplate,

      autosize: true,

      dragmode: false,

      height,

      margin,
    };

    const config: Partial<Plotly.Config> = { responsive: true };

    Plotly.newPlot(plot, data, layout, config);
  }, [Plotly, xLabels, yValues, height, margin, customWidth]);

  return <div ref={ref} />;
}

export default function LazyLineChart({
  title,
  xLabels,
  yValues,
  ...otherProps
}: LineChartProps) {
  return (
    <PlotlyLoader version="module">
      {(Plotly) =>
        xLabels && yValues ? (
          <LineChart
            title={title}
            xLabels={xLabels}
            yValues={yValues}
            Plotly={Plotly}
            // eslint-disable-next-line react/jsx-props-no-spreading
            {...otherProps}
          />
        ) : null
      }
    </PlotlyLoader>
  );
}
