import { Margin } from "plotly.js";
import React, { useEffect, useRef } from "react";
import ExtendedPlotType from "../models/ExtendedPlotType";
import PlotlyLoader, { PlotlyType } from "./PlotlyLoader";

export interface LineChartProps {
  title: string;
  yAxisTitle: string;
  curves: any;
  showLegend: boolean;
  onLoad: (plot: ExtendedPlotType) => void;
  height?: number | "auto";
  margin?: Margin;
  customWidth?: number | undefined;
}

const calcPlotHeight = (plot: HTMLDivElement) => {
  const fullHeight = window.innerHeight - plot.offsetTop - 26;
  return Math.min(plot.offsetWidth * 0.8, fullHeight);
};

type LineChartWithPlotly = LineChartProps & { Plotly: PlotlyType };

function LineChart({
  title,
  yAxisTitle,
  curves,
  showLegend,
  onLoad = () => {},
  height = "auto",
  customWidth = undefined,
  margin = {
    l: 80,

    r: 40,

    b: 65,

    t: 60,

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

    const xAxisTemplate: Partial<Plotly.LayoutAxis> = {
      visible: true,
      type: "linear",
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

      showlegend: showLegend,

      height: height === "auto" ? calcPlotHeight(plot) : height,

      margin,
    };

    const config: Partial<Plotly.Config> = { responsive: true };

    Plotly.newPlot(plot, curves, layout, config);
  }, [Plotly, showLegend, height, margin, customWidth, title, yAxisTitle]);

  return <div ref={ref} />;
}

export default function LazyLineChart({
  title,
  curves,
  ...otherProps
}: LineChartProps) {
  return (
    <PlotlyLoader version="module">
      {(Plotly) =>
        curves ? (
          <LineChart
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
