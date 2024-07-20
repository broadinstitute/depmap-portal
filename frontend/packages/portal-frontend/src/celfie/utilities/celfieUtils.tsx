/* eslint-disable object-shorthand */
import { colorPalette } from "depmap-shared";
import { Node } from "src/constellation/models/constellation";
import * as models from "src/plot/models/volcanoPlotModels";
import { ComputeResponse, ComputeResponseRow } from "@depmap/compute";
import { assert } from "@depmap/utils";
import { ColorByOption } from "../models/celfie";

export interface TaskComputeResponseRow extends ComputeResponseRow {
  id: string;
  featureDataset?: string;
}

export const addOrRemoveDataset = (
  datasets: Array<string>,
  dataset: string
): Array<string> => {
  const index = datasets.indexOf(dataset);
  // if task id is in list, remove it
  if (index >= 0) {
    datasets.splice(index, 1);
  } else {
    datasets.push(dataset);
  }
  return datasets;
};

export function selectDatasets(
  dataset: string,
  selectedDatasets: Array<string>,
  setSelectedDatasets: (datasets: Array<string>) => void
) {
  return function clickHandler() {
    // clone datasets to pass into function bc you shouldn't mutate state directly
    const selectedDatasetsClone = [...selectedDatasets];
    // returns a new list of task ids
    const newDatasetsSelected = addOrRemoveDataset(
      selectedDatasetsClone,
      dataset
    );
    setSelectedDatasets(newDatasetsSelected);
  };
}

export const formatTopVolcanoData = (
  taskList: Array<ComputeResponse>,
  taskIds: Array<{ dataset: string; taskId: string }>,
  numPoints: number
): Array<TaskComputeResponseRow> => {
  // Filter data by what task ids were selected
  const filteredTasks = taskList.filter((task) => {
    const selectedTaskIds = taskIds.map((datasetTask) => {
      return datasetTask.taskId;
    });
    return selectedTaskIds.includes(task.id);
  });

  let combinedTasks: any = [];

  filteredTasks.forEach((task) => {
    const datasetTask = taskIds.find(
      (datasetId) => datasetId.taskId === task.id
    );
    const dataWithTaskId = task.result.data.map((data) => ({
      ...data,
      id: task.id,
      featureDataset: `${data.label}: ${datasetTask?.dataset || "unknown"}`,
    }));
    combinedTasks.push(dataWithTaskId);
  });
  combinedTasks = combinedTasks
    .flat(1)
    .filter(
      (data: any) => data.Cor != null && data.PValue != null
    ) as Array<TaskComputeResponseRow>;

  // we want to sort data by -log pvalue descending but since we convert that later in volcano plot
  // sort by p value ascending since a lower p value means higher -log(p value)
  const sortedPlotData: Array<TaskComputeResponseRow> = combinedTasks.sort(
    (a: TaskComputeResponseRow, b: TaskComputeResponseRow) => {
      return a.PValue - b.PValue;
    }
  );

  const slicedData: Array<TaskComputeResponseRow> = sortedPlotData.slice(
    0,
    Math.min(numPoints, sortedPlotData.length)
  );
  return slicedData;
};

export const reformatToVolcanoData = (
  taskList: Array<ComputeResponse>,
  taskIds: Array<{ dataset: string; taskId: string }>,
  colorForTasks: { [task: string]: string },
  volcanoLimit: number
): Array<models.VolcanoData> => {
  if (taskList == null) {
    return [
      { x: [], y: [], label: [], text: [], isSignificant: [], color: "" },
    ];
  }

  const slicedData = formatTopVolcanoData(taskList, taskIds, volcanoLimit);

  const x = slicedData.map((c: any) => c.Cor);
  const y = slicedData.map((c: any) => c.PValue);
  const label = slicedData.map((c: any) => c.label);
  const text = slicedData.map(
    (c: any) =>
      `<b>${c.label}</b><br>` +
      `<i>Correlation:</i> ${c.Cor ? c.Cor.toFixed(3) : "N/A"}<br>` +
      `<i>-log10(p-value):</i> ${
        c.PValue ? -Math.log10(c.PValue).toFixed(3) : "N/A"
      }<br>` +
      `<i>Feature Type:</i> ${
        taskIds.find((el) => el.taskId === c.id)?.dataset || "unknown"
      }`
  );
  const isSig = new Array(slicedData.length);
  isSig.fill(true);
  const color: Array<string> = slicedData.map((c: any) => {
    return colorForTasks[c.id];
  });
  const traces: Array<models.VolcanoData> = [];

  traces.push({
    x,
    y,
    label,
    text,
    isSignificant: isSig,
    color,
  });
  return traces;
};

export const getCurrentPlotAnnotations = (ref: React.RefObject<any>) => {
  const currentAnnotations = ref.current.layout.annotations;
  if (currentAnnotations) {
    return [...currentAnnotations];
  }
  return [];
};

// We pass in the current plot layout annotations that contains the positional info and add them to the new list of annotions if it is in annotatedPoints.
// Otherwise, we create a new annotation for the point and add it to the new list of annotations.
// If the updated annotatedPoints no longer has a current annotation, then this shouldn't add it to the new list of annotations
// This solves the problem of annotation positions being reset but I wonder if there is a more optimal solution than having to search through all the current annotations
// Something to consider is using Plotly callbacks and directly mutating the annotations stored on plotly ref as shown https://codepen.io/plotly/pen/mVLQLK
export const formatVolcanoAnnotations = (
  annotatedPoints: Array<TaskComputeResponseRow>,
  currentAnnotations: Array<Partial<Plotly.Annotations>>
): Array<Partial<Plotly.Annotations>> => {
  const annotations: Array<Partial<Plotly.Annotations>> = [];
  annotatedPoints.forEach((annotatedPoint: TaskComputeResponseRow) => {
    const yPos = -Math.log10(annotatedPoint.PValue);
    const existingAnnotation = currentAnnotations.find(
      (currAnnotation) =>
        currAnnotation.text === annotatedPoint.label &&
        currAnnotation.x === annotatedPoint.Cor &&
        currAnnotation.y === yPos
    );
    if (existingAnnotation) {
      annotations.push(existingAnnotation);
    } else {
      annotations.push({
        text: annotatedPoint.label,
        x: annotatedPoint.Cor,
        y: yPos,
        xref: "x",
        yref: "y",
        arrowhead: 0,
        ax: -50,
        ay: 20,
        standoff: 4,
      });
    }
  });
  return annotations;
};

export const formatNetworkAnnotations = (
  annotatedPoints: Array<TaskComputeResponseRow>,
  graphNodes: Array<Node>,
  currentAnnotations: Array<Partial<Plotly.Annotations>>
): Array<Partial<Plotly.Annotations>> => {
  const annotations: Array<Partial<Plotly.Annotations>> = [];
  const annotatedNodes = graphNodes.filter((node) => {
    return annotatedPoints.some(
      (x) => x.id === node.task && x.label === node.feature
    );
  });

  annotatedNodes.forEach((node: Node) => {
    const existingAnnotation = currentAnnotations.find(
      (currAnnotation) =>
        currAnnotation.text === node.feature &&
        currAnnotation.x === node.x &&
        currAnnotation.y === node.y
    );
    if (existingAnnotation) {
      annotations.push(existingAnnotation);
    } else {
      annotations.push({
        text: node.feature,
        x: node.x,
        y: node.y,
        xref: "x",
        yref: "y",
        arrowhead: 0,
        standoff: 4,
      });
    }
  });

  return annotations;
};

export const getNetworkPlotlyDataColor = (
  datasetTasks: { [dataset: string]: string },
  selectedColorOption: ColorByOption,
  values: Array<number | string>,
  colorForTasks: { [task: string]: string }
): Partial<Plotly.PlotData> => {
  function areNumValues() {
    const areNum = values.every((value) => typeof value === "number");
    return areNum;
  }

  let cmin = 0;
  let cmax = 0;

  const plotData: Partial<Plotly.PlotData> & {
    marker: Partial<Plotly.PlotMarker>;
  } = {
    marker: { size: 10 },
    transforms: undefined,
  };

  if (selectedColorOption !== "task") {
    assert(areNumValues);
    // reduce must have at least one item in original array
    if (values.length > 0) {
      cmin = (values as Array<number>).reduce((a, b) => Math.min(a, b));
      cmax = (values as Array<number>).reduce((a, b) => Math.max(a, b));
    }
  }

  if (selectedColorOption === "effect") {
    plotData.marker.colorbar = {
      title: "Correlation",
      thickness: 25,
      len: 1,
      xanchor: "left",
    };

    plotData.marker.color = values;
    plotData.marker.cmin = cmin;
    plotData.marker.cmax = cmax;
    plotData.marker.colorscale = [
      [0, colorPalette.negative_color],
      [-cmin / (cmax - cmin), colorPalette.zero_color],
      [1, colorPalette.positive_color],
    ];

    return plotData;
  }

  if (selectedColorOption === "-log10(P)") {
    plotData.marker.colorbar = {
      title: "-log10(P)",
      thickness: 25,
      len: 1,
      xanchor: "left",
    };

    plotData.marker.color = values;
    plotData.marker.cmin = 0;
    plotData.marker.cmax = cmax;
    plotData.marker.colorscale = "Viridis";

    return plotData;
  }

  if (selectedColorOption === "direction") {
    // transforms is double array otherwise it will not work for unknown reasons
    plotData.transforms = [
      [
        {
          type: "groupby",
          groups: values.map((value) =>
            typeof value === "number" && value >= 0 ? "up" : "down"
          ),
          styles: [
            {
              target: "up",
              value: {
                marker: {
                  color: colorPalette.positive_color,
                },
              },
            },
            {
              target: "down",
              value: { marker: { color: colorPalette.negative_color } },
            },
          ],
        },
      ],
    ] as Partial<Plotly.Transform>[];

    return plotData;
  }

  if (selectedColorOption === "task") {
    const groups = values.map((value) => {
      const dataset = Object.keys(datasetTasks).find(
        (key) => datasetTasks[key] === value
      );
      return dataset;
    });
    const styles = Object.keys(colorForTasks).map((key) => {
      const dataset = Object.keys(datasetTasks).find(
        (task) => datasetTasks[task] === key
      );
      return {
        target: dataset,
        value: {
          marker: {
            color: colorForTasks[key],
          },
        },
      };
    });
    // transforms is double array otherwise it will not work for unknown reasons

    plotData.transforms = [
      [
        {
          type: "groupby",
          groups: groups,
          styles: styles,
        },
      ],
    ] as Partial<Plotly.Transform>[];

    return plotData;
  }
  return {};
};

export const formatNetworkPlotlyData = (
  nodes: Array<Node>,
  datasetTasks: { [dataset: string]: string }
): Partial<Plotly.PlotData> => {
  const plotlyData: Partial<Plotly.PlotData> = {
    text: nodes.map((node) => {
      const dataset = Object.keys(datasetTasks).find(
        (key) => datasetTasks[key] === node.task
      );
      const text =
        `<b>${node.feature}</b><br>` +
        `<i>Correlation:</i> ${node.effect.toFixed(3)}<br>` +
        `<i>-log10(p-value):</i> ${
          node["-log10(P)"] ? node["-log10(P)"].toFixed(3) : "N/A"
        }<br>` +
        `<i>Feature Type:</i> ${dataset}`;
      return text;
    }),
  };

  return plotlyData;
};

export function formatTrace(volcanoData: Array<models.VolcanoData>) {
  const traces: any = volcanoData.map((volcanoDataTrace) => {
    return {
      x: volcanoDataTrace.x,
      y: volcanoDataTrace.y.map((pValue: number) => {
        return -Math.log10(pValue); // log transforms the y axis
      }),
      text: volcanoDataTrace.label.map((label: string) => `<b>${label}</b>`),
      customdata: volcanoDataTrace.label, // original label, for point click to match against
      marker: {
        size: 2,
        color: volcanoDataTrace.color,
      },
      hoverinfo: "x+y+text",
      mode: "markers",
      type: "scatter",
      showlegend: false,
    };
  });

  return traces;
}

export const getColorForDataset = (index: number): any => {
  const colorKey: any = {
    0: colorPalette.expression_color, // expression
    1: colorPalette.copy_number_color, // copy number
    2: colorPalette.damaging_color, // damaging mutations
    3: colorPalette.hotspot_color, // hotspot mutations
    4: colorPalette.other_non_conserving_color, // other non-conserving mutations
  };
  return colorKey[index];
};

export const formatLayout = () => {
  const bounds = { width: 150, height: 150 };
  const layout: any = {
    width: bounds.width,
    height: bounds.height,
    hovermode: "closest",
    xaxis: {
      tickfont: {
        size: 5,
        color: "black",
      },
    },
    yaxis: {
      tickfont: {
        size: 5,
        color: "black",
      },
    },
    margin: {
      l: 20,
      r: 10,
      b: 20,
      t: 10,
    },
  };
  return layout;
};

export function getDownloadVolcanoData(
  slicedData: Array<TaskComputeResponseRow>,
  selectedDatasetTasks: Array<{ dataset: string; taskId: string }>
) {
  const downloadData: any = [];
  for (let i = 0; i < slicedData.length; i += 1) {
    const point = {
      dataset: selectedDatasetTasks.find((el) => el.taskId === slicedData[i].id)
        ?.dataset,
      cor: slicedData[i].Cor,
      pVal: slicedData[i].PValue,
      label: slicedData[i].label,
    };
    downloadData.push({
      Feature: point.dataset,
      Label: point.label,
      Correlation: point.cor,
      PValue: -Math.log10(point.pVal),
    });
  }
  return downloadData;
}

export const getNumGenes = (increment: number, max: number): Array<number> => {
  return Array(max / increment + 1)
    .fill(undefined)
    .map((_, idx) => {
      return idx * increment;
    });
};
