import React from "react";
import { PartialTwoClassComparisonConfiguration } from "../../types/AnalysisConfiguration";
import { AnalysisReducerAction } from "../../reducers/analysisReducer";
import KindSection from "./sections/KindSection";
import DatasetSection from "./sections/DatasetSection";
import InGroupSection from "./sections/InGroupSection";
import OutGroupSection from "./sections/OutGroupSection";
import styles from "../../styles/CustomAnalysesPage.scss";

interface Props {
  analysis: PartialTwoClassComparisonConfiguration;
  dispatch: React.Dispatch<AnalysisReducerAction>;
}

function TwoClassComparison({ analysis, dispatch }: Props) {
  return (
    <div className={styles.AnalysisConfigLayout}>
      <KindSection analysis={analysis} dispatch={dispatch} />
      <DatasetSection analysis={analysis} dispatch={dispatch} />
      <InGroupSection analysis={analysis} dispatch={dispatch} />
      <OutGroupSection analysis={analysis} dispatch={dispatch} />
    </div>
  );
}

export default TwoClassComparison;
