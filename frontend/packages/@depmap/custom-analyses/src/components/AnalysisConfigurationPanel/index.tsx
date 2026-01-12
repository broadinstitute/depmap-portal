import React from "react";
import {
  AnalysisConfiguration,
  PartialPearsonCorrelationConfiguration,
  PartialTwoClassComparisonConfiguration,
} from "../../types/AnalysisConfiguration";
import { AnalysisReducerAction } from "../../reducers/analysisReducer";
import PearsonCorrelation from "./PearsonCorrelation";
import TwoClassComparison from "./TwoClassComparison";
import UnknownAnalysis from "./UnknownAnalysis";

interface Props {
  analysis: Partial<AnalysisConfiguration>;
  dispatch: React.Dispatch<AnalysisReducerAction>;
}

function AnalysisConfigurationPanel({ analysis, dispatch }: Props) {
  if (analysis.kind === "pearson_correlation") {
    return (
      <PearsonCorrelation
        analysis={analysis as PartialPearsonCorrelationConfiguration}
        dispatch={dispatch}
      />
    );
  }

  if (analysis.kind === "two_class_comparison") {
    return (
      <TwoClassComparison
        analysis={analysis as PartialTwoClassComparisonConfiguration}
        dispatch={dispatch}
      />
    );
  }

  return <UnknownAnalysis analysis={analysis} dispatch={dispatch} />;
}

export default AnalysisConfigurationPanel;
