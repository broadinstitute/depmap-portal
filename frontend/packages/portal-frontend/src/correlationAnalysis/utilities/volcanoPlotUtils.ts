import { hexToRgba } from "src/common/utilities/plotUtils";
import { VolcanoPlotData } from "../models/VolcanoPlot";
import { PlotData, Layout } from "plotly.js";

export const formatVolcanoTrace = (
  volcanoData: Array<VolcanoPlotData>,
  selectedFeatures: string[],
  hasOtherSelectedCorrelatedDatasetFeatures: boolean
) => {
  const traces = volcanoData.map((volcanoDataTrace) => {
    const traceColor = hexToRgba(volcanoDataTrace.color, 0.5);
    const plotlyTrace: Partial<PlotData> = {
      name: volcanoDataTrace.name,
      x: volcanoDataTrace.x,
      y: volcanoDataTrace.y,
      text: volcanoDataTrace.label,
      hovertext: volcanoDataTrace.text,
      marker: {
        line: {
          color: volcanoDataTrace.label.map((label) => {
            return selectedFeatures.includes(label) ? "black" : traceColor;
          }),
          width: 2,
        },
        size: 7,
        color: traceColor,
        opacity: volcanoDataTrace.label.map((label) => {
          if (selectedFeatures.length) {
            return selectedFeatures.includes(label) ? 1 : 0.4;
          }
          if (
            selectedFeatures.length === 0 &&
            hasOtherSelectedCorrelatedDatasetFeatures
          ) {
            return 0.4;
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

export const formatLayout = (xMin: number, xMax: number) => {
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
      range: [xMin, xMax],
    },
    yaxis: {
      title: { text: `-log10(q value)`, font: { size: 11 } },
      tickfont: { size: 10 },
    },
  };
  return layout;
};
