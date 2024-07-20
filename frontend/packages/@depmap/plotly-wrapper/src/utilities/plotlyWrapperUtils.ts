/* eslint-disable */
import * as Plotly from "plotly.js";
import { assert } from "@depmap/utils";
import { PlotHTMLElement } from "../models/plotlyPlot";
import { PlotlyParams } from "../models/plotlyWrapper";

export const assertSelectedPointsNotProvided = (plotlyParams: PlotlyParams) => {
  if (plotlyParams.data) {
    for (const data of plotlyParams.data) {
      assert(
        !("selectedpoints" in data) &&
          !("selected" in data) &&
          !("unselected" in data),
        `
        Please implement styling of selected points using Plotly.restyle
        "selectedpoints", "selected", and "unselected" cannot be used with PlotlyWrapper

        Explanation:
        selectedpoints are set in plotly internal code when the plotly box or lasso selections are used.
        Plotly internal code also automatically applies the selected and unselected styles to selectedpoints.
        It might be tempting to use selectedpoints and styling via "selected" to implement visuals such as for an onClick
        However, any "selected" styling will apply to all points that are selected using the box/lasso selection tools. There is no way to decouple this
        It would be possible for the PlotlyWrapper selection tools to, when they are used, store the old "selected" style and "selectedpoints" selection,
        manually apply a plain selection style and automatically (through internal plotly code) set the new selected points,
        then restore the old versions on deselection.
        However, the two effects still cannot happen at the same time, and our use cases usually want to allow them to happen at the same time.
        `
      );
    }
  }
};

/**
 * This provides a utility wrapper to when a dev wants to have some on click behavior
 * Specifically, it
 *   1) Adds hover and unhover to points
 *   2) Checks whether the point clicked is a single scatter point
 */
export const formatPointClickCallbacks = (
  graphDiv: PlotHTMLElement,
  onPointClick: (point: Plotly.PlotDatum) => void
) => {
  const nsewdrag = graphDiv.querySelector(".nsewdrag") as PlotHTMLElement;
  return {
    plotly_click: withScatterPointValidation(onPointClick),
    plotly_hover: withScatterPointValidation(() => {
      // this might have to get more complicated/be able to be overriden, e.g. for more complex plots with multiple sub-plots
      nsewdrag.style.cursor = "pointer";
    }),
    plotly_unhover: withScatterPointValidation(() => {
      // this might have to get more complicated/be able to be overriden, e.g. for more complex plots with multiple sub-plots
      nsewdrag.style.cursor = "";
    }),
  };
};

export const withScatterPointValidation = (
  functionToWrap: (point: Plotly.PlotDatum) => void
): ((data: Plotly.PlotMouseEvent) => void) => {
  // Wrap with checks for whether the point is
  //   1) exactly one point, and
  //   2) on a scatter plot
  // These are a preliminary, simple checks as to whether the point in question is a single point. They get particularly important when there are additional, non-scatter traces on the plot

  // Additional checks may be needed, depending on the complexity of the plot
  // These checks can be implemented in functionToWrap
  const wrappedFunction = (data: Plotly.PlotMouseEvent) => {
    if (data.points.length === 1) {
      const point = data.points[0] as any;
      const shouldCall = ["scatter", "scattergl"].includes(
        point.fullData?.type
      );

      if (shouldCall) {
        functionToWrap(point);
      }
    }
  };
  return wrappedFunction;
};
