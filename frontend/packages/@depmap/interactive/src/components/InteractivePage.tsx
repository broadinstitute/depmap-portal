/* eslint-disable */
import * as React from "react";
import { useLocation } from "react-router-dom";
import { ControlledPlot } from "./ControlledPlot";

type PlotlyType = typeof import("plotly.js");

interface InteractivePageProps {
  query: { [key: string]: string };
  showCustomAnalysis: boolean;
  updateReactLoadStatus: () => void;
  launchCellLineSelectorModal: () => void;
  Plotly: PlotlyType;
}

const InteractivePage = (props: InteractivePageProps) => {
  const defaultProps = {
    x: "",
    y: "",
    color: "",
    filter: "",
    regressionLine: "false",
    associationTable: "false",
    defaultCustomAnalysisToX: "false",
    colors: "",
  } as any;
  const validProps = Object.keys(defaultProps);
  const controlledPlotProps = { ...defaultProps };

  const { query } = props;
  for (const prop of validProps) {
    if (Object.prototype.hasOwnProperty.call(query, prop)) {
      controlledPlotProps[prop] = query[prop];
    } else {
      controlledPlotProps[prop] = defaultProps[prop];
    }
  }
  controlledPlotProps.updateReactLoadStatus = props.updateReactLoadStatus;

  // If the user is entering from the Custom Analysis page, get the Custom Analysis results
  const location = useLocation();
  const initialCustomAnalysisResults = location.state;

  return (
    <ControlledPlot
      Plotly={props.Plotly}
      initialCustomAnalysisResults={initialCustomAnalysisResults}
      showCustomAnalysis={props.showCustomAnalysis}
      launchCellLineSelectorModal={props.launchCellLineSelectorModal}
      {...controlledPlotProps}
    />
  );
};

export default InteractivePage;
