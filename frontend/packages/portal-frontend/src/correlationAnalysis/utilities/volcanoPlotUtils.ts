import { VolcanoPlotData } from "../models/VolcanoPlot";
import Plotly, { PlotData, Layout, Config, PlotMouseEvent } from "plotly.js";

export const formatVolcanoTrace = (volcanoData: Array<VolcanoPlotData>) => {
  const traces = volcanoData.map((volcanoDataTrace) => {
    const plotlyTrace: Partial<PlotData> = {
      name: volcanoDataTrace.name,
      x: volcanoDataTrace.x,
      y: volcanoDataTrace.y,
      text: volcanoDataTrace.label,
      marker: {
        line: {
          color: "black",
          width: 1,
        },
        size: 7,
        color: volcanoDataTrace.color,
      },
      hoverinfo: "text",
      mode: "markers",
      type: "scatter",
      showlegend: false,
    };
    return plotlyTrace;
  });

  return traces;
};

export const formatLayout = () => {
  const layout: Partial<Layout> = {
    autosize: true, // autosizes width but not height
    width: 600,
    height: 600,
    hovermode: "closest",
    margin: {
      l: 50,
      r: 50,
      b: 50,
      t: 30,
    },
    xaxis: {
      title: "Correlation Coefficient",
    },
    yaxis: {
      title: `-log10(q value)`,
    },
  };
  return layout;
};
