import { VolcanoPlotData } from "../models/VolcanoPlot";
import { PlotData, Layout } from "plotly.js";

export const formatVolcanoTrace = (
  volcanoData: Array<VolcanoPlotData>,
  selectedFeatures: string[],
  hasOtherSelectedFeatureTypeFeatures: boolean
) => {
  const traces = volcanoData.map((volcanoDataTrace) => {
    const traceColor = volcanoDataTrace.color;
    const plotlyTrace: Partial<PlotData> = {
      name: volcanoDataTrace.name,
      x: volcanoDataTrace.x,
      y: volcanoDataTrace.y,
      text: volcanoDataTrace.label,
      hovertext: volcanoDataTrace.text,
      marker: {
        line: {
          color: "black",
          width: 1,
        },
        size: 7,
        color: volcanoDataTrace.label.map((label) => {
          if (selectedFeatures.length) {
            // gray out points that are not selected
            return selectedFeatures.includes(label) ? traceColor : "lightgray";
          }
          if (
            selectedFeatures.length === 0 &&
            hasOtherSelectedFeatureTypeFeatures
          ) {
            return "lightgray";
          }

          return traceColor;
        }),
        opacity: volcanoDataTrace.label.map((label) => {
          if (selectedFeatures.length) {
            return selectedFeatures.includes(label) ? 1 : 0.05;
          }
          if (
            selectedFeatures.length === 0 &&
            hasOtherSelectedFeatureTypeFeatures
          ) {
            return 0.05;
          }

          return 1;
        }),
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
    height: 600,
    hovermode: "closest",
    margin: {
      l: 70,
      r: 0,
      b: 50,
      t: 30,
    },
    xaxis: {
      title: { text: "Correlation Coefficient", font: { size: 12 } },
      tickfont: { size: 10 },
    },
    yaxis: {
      title: { text: `-log10(q value)`, font: { size: 11 } },
      tickfont: { size: 10 },
    },
  };
  return layout;
};
