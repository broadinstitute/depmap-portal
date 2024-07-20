/* eslint-disable */
import { PlotlyParams } from "../models/plotlyWrapper";
import { assert } from "@depmap/utils";
import isEqual from "lodash.isequal";

const annotationToggleKey = "selectToLabelAnnotationKey";

/**
 * Allow labels to be dragged around
 * Documentation for plotly config is here https://github.com/plotly/plotly.js/blob/master/src/plot_api/plot_config.js#L22-L86
 */
export const modifyPlotlyParamsConfig = (plotlyParams: PlotlyParams) => {
  plotlyParams.config = {
    ...plotlyParams.config,
    edits: {
      annotationTail: true,
      // spreading second allows this to be overridable
      ...plotlyParams.config?.edits,
    },
  };
  return plotlyParams;
};

/**
 * Given the previously visible labels and current plotly params, get the subset of visible labels that still exist in the plotly params
 */
export const getNewVisibleLabels = (
  prevVisibleLabels: Set<string>,
  plotlyParams: PlotlyParams
) => {
  assert(annotationToggleKey);

  if (!plotlyParams.layout?.annotations) {
    return prevVisibleLabels;
  }

  const possibleLabels = new Set(
    plotlyParams.layout.annotations.reduce(
      (accumulator: Array<string>, annotation: any) => {
        if (annotationToggleKey in annotation) {
          accumulator.push(annotation[annotationToggleKey]);
        }
        return accumulator;
      },
      []
    )
  );
  const newVisibleLabels = new Set(
    Array.from(prevVisibleLabels.values()).filter((label) =>
      possibleLabels.has(label)
    )
  );
  // Preserve object identity if the contents are the same, for performance reasons because this is used for set state
  if (isEqual(prevVisibleLabels, newVisibleLabels)) {
    return prevVisibleLabels;
  }
  console.debug("invalidating old visible labels");
  return newVisibleLabels;
};

/**
 * In this filters plotly selection events that are not actually selections
 */
export const isValidSelection = (
  plotlySelectedEvent?: Plotly.PlotSelectionEvent
) => {
  // The user might have selected nothing, or clicked the plot without dragging when the dragmode is select
  return plotlySelectedEvent && plotlySelectedEvent.points.length > 0;
};

export const assertCorrectSetup = (plotlyLayout: Partial<Plotly.Layout>) => {
  assert(
    plotlyLayout.annotations,
    "No annotations configured for the plot. Please configure annotations if you want to use this widget"
  );
  return true;
};

export const getPlotlyCallbacks = (
  setPlotlySelectedEvent: (event: Plotly.PlotSelectionEvent) => void
) => {
  const callbacks = {
    plotly_deselect: () => {
      setPlotlySelectedEvent(null as any);
    },
    plotly_selected: (event: Plotly.PlotSelectionEvent) => {
      // fixme: state represents the latest plotly selection event
      // We want it to actually represent plotly's UI
      // Specifically, clicking on a plot with box select mode fires an event, but does not visually deselect any previously selected points
      setPlotlySelectedEvent(event);
    },
  };
  return callbacks;
};

export const addLabelToSelectedPoints = (
  annotations: Array<Partial<Plotly.Annotations>>,
  plotlySelectedEvent: Plotly.PlotSelectionEvent,
  setPlotlySelectedEvent: (event: Plotly.PlotSelectionEvent) => void,
  visibleLabels: Set<string>,
  setVisibleLabels: (labels: Set<string>) => void
) => {
  assert(
    isValidSelection(plotlySelectedEvent),
    "valid selection should exist before the button that fires this is even shown"
  );
  toggleAnnotation(
    annotations,
    plotlySelectedEvent,
    visibleLabels,
    setVisibleLabels,
    true
  );
  setPlotlySelectedEvent(null as any); // deselect points
};
export const removeLabelFromSelectedPoints = (
  annotations: Array<Partial<Plotly.Annotations>>,
  plotlySelectedEvent: Plotly.PlotSelectionEvent,
  setPlotlySelectedEvent: (event: Plotly.PlotSelectionEvent) => void,
  visibleLabels: Set<string>,
  setVisibleLabels: (labels: Set<string>) => void
) => {
  assert(
    isValidSelection(plotlySelectedEvent),
    "valid selection should exist before the button that fires this is even shown"
  );
  toggleAnnotation(
    annotations,
    plotlySelectedEvent,
    visibleLabels,
    setVisibleLabels,
    false
  );
  setPlotlySelectedEvent(null as any); // deselect points
};

const toggleAnnotation = (
  annotations: Array<Partial<Plotly.Annotations>>,
  plotlySelectedEvent: Plotly.PlotSelectionEvent,
  visibleLabels: Set<string>,
  setVisibleLabels: (labels: Set<string>) => void,
  visible: boolean
) => {
  const labelsToToggle = getLabelsToToggle(plotlySelectedEvent);

  // update what labels are currently visible
  const newVisibleLabels = new Set(visibleLabels); // make a new object so that we are not mutating state
  for (const label of labelsToToggle) {
    if (visible) {
      newVisibleLabels.add(label);
    } else {
      newVisibleLabels.delete(label);
    }
  }
  setVisibleLabels(newVisibleLabels);
};

export const getLabelsToToggle = (
  plotlySelectedEvent: Plotly.PlotSelectionEvent
): Array<string> => {
  // sometimes the selection includes things that are not points, or might be part of different traces that don't have valid annotations
  // so filter to check that custom data exists, and the toggle key exists
  const points = plotlySelectedEvent.points as Array<{
    customdata: { [key: string]: any };
  }>;
  return points
    .filter(
      (point) => point.customdata && annotationToggleKey in point.customdata
    )
    .map((point) => point.customdata[annotationToggleKey]);
};

/**
  Given the visibleLabels state and that plotlyParams, get the update object to pass to Plotly.restyle
*/
export const getPlotlyRestyleUpdate = (
  visibleLabels: Set<string>,
  plotlyParams: PlotlyParams
) => {
  assert(annotationToggleKey);

  const update: any = {};

  if (!plotlyParams.layout?.annotations) {
    return null;
  }

  for (let i = 0; i < plotlyParams.layout.annotations.length; i++) {
    const annotation: any = plotlyParams.layout.annotations[i];
    if (annotationToggleKey in annotation && !annotation.forceHidden) {
      update[`annotations[${i}].visible`] = visibleLabels.has(
        annotation[annotationToggleKey]
      );
    }
  }
  return Object.keys(update).length > 0 ? update : null;
};
