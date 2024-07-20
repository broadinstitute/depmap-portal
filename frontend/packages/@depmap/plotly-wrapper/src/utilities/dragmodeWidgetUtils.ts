/* eslint-disable */
import * as Plotly from "plotly.js";
import { PlotlyParams } from "../models/plotlyWrapper";
import { assert } from "@depmap/utils";

export const modifyPlotlyParamsConfig = (plotlyParams: PlotlyParams) => {
  if (plotlyParams.layout) {
    assert(
      !("dragmode" in plotlyParams.layout),
      "We have not yet implemented an uncontrolled version or mode for this component"
    );
  }
  plotlyParams = hidePlotlyModeBarButtons(plotlyParams);
  return plotlyParams;
};

const hidePlotlyModeBarButtons = (plotlyParams: PlotlyParams) => {
  // documentation on modeBarButtons: https://github.com/plotly/plotly.js/blob/master/src/plot_api/plot_config.js#L304
  const newConfig = {
    modeBarButtons: [
      ["zoomIn2d", "zoomOut2d", "autoScale2d"],
    ] as Plotly.ModeBarDefaultButtons[][],
    displaylogo: false,
    ...plotlyParams.config, // spread later, to make these defaults overrideable
  };
  plotlyParams.config = newConfig;
  return plotlyParams;
};
