import React from "react";
import { AnalysisConfiguration } from "../../types/AnalysisConfiguration";
import { AnalysisReducerAction } from "../../reducers/analysisReducer";
import KindSection from "./sections/KindSection";
import styles from "../../styles/CustomAnalysesPage.scss";

interface Props {
  analysis: Partial<AnalysisConfiguration>;
  dispatch: React.Dispatch<AnalysisReducerAction>;
}

function UnknownAnalysis({ analysis, dispatch }: Props) {
  return (
    <div className={styles.AnalysisConfigLayout}>
      <KindSection analysis={analysis} dispatch={dispatch} />
      <div />
      <div />
      <div />
    </div>
  );
}

export default UnknownAnalysis;
