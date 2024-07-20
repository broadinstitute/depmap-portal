import * as Plotly from "plotly.js";
import {
  PlotlyParams,
  PlotlyWrapperScatterData,
  PlotlyWrapperLayout,
} from "../models/plotlyWrapper";
// toggling between two data options
export const getPlotlyParams = (option: boolean): PlotlyParams => {
  let data: [Pick<PlotlyWrapperScatterData, "x" | "y" | "customdata" | "type">];
  if (option) {
    data = [
      {
        x: [0.67, -0.522, 0.4554, 0.409, -0.309, 0.1932, -0.148, 0.0379],
        y: [0.0338, 0.121, 0.1858, 0.239, 0.384, 0.592, 0.682, 0.922],
        customdata: [
          { selectToLabelAnnotationKey: "KDM7A" },
          { selectToLabelAnnotationKey: "PSG7" },
          { selectToLabelAnnotationKey: "MAP4K4" },
          { selectToLabelAnnotationKey: "SOX10" },
          { selectToLabelAnnotationKey: "HNF1B" },
          { selectToLabelAnnotationKey: "ANOS1" },
          { selectToLabelAnnotationKey: "SWI5" },
          { selectToLabelAnnotationKey: "MED1" },
        ],
        type: "scatter",
      },
    ];
  }
  data = [
    {
      x: [0.0338, 0.121, 0.1858, 0.239, 0.384, 0.592, 0.682],
      y: [0.67, -0.522, 0.4554, 0.409, -0.309, 0.1932, -0.148],
      customdata: [
        { selectToLabelAnnotationKey: "KDM7A" },
        { selectToLabelAnnotationKey: "PSG7" },
        { selectToLabelAnnotationKey: "MAP4K4" },
        { selectToLabelAnnotationKey: "SOX10" },
        { selectToLabelAnnotationKey: "HNF1B" },
        { selectToLabelAnnotationKey: "ANOS1" },
        { selectToLabelAnnotationKey: "SWI5" },
      ],
      type: "scatter",
    },
  ];

  // Example layout for the plot
  const layout: Partial<PlotlyWrapperLayout> = {
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
      title: "xLabel",
    },
    yaxis: {
      title: `yLabel`,
    },
  };

  // Add annotations
  const annotations: Array<Partial<Plotly.Annotations>> = [];

  // Example annotations for a labeling points, that will be toggled by SelectToLabel
  for (let i = 0; i < data[0].x.length; i++) {
    annotations.push({
      // @ts-expect-error We attach our own property that is outside of defined Plotly types. This is useful for implementation because it is passed to event handlers
      selectToLabelAnnotationKey:
        data[0].customdata[i].selectToLabelAnnotationKey,
      text: data[0].customdata[i].selectToLabelAnnotationKey,
      x: data[0].x[i] as number,
      y: data[0].y[i] as number,
      xref: "x",
      yref: "y",
      arrowhead: 0,
      standoff: 4, // unclear exact difference between standoff vs startstandoff
      visible: false, // THIS IS IMPORTANT. Invisibility should be set to false for performance reason. Setting in to true well likely look the same but perform poorly.
    });
  }
  // Add a permanent annotation that is not toggleable
  annotations.push({
    text: "always here", // this annotation is not toggle-able
    x: data[0].x[0] as number,
    y: data[0].y[0] as number,
    xref: "x",
    yref: "y",
  });

  layout.annotations = annotations;
  const config = {};
  return { data, layout, config };
};
