import React from "react";
import { PartialPearsonCorrelationConfiguration } from "../../types/AnalysisConfiguration";
import { AnalysisReducerAction } from "../../reducers/analysisReducer";
import KindSection from "./sections/KindSection";
import DatasetSection from "./sections/DatasetSection";
import SliceSection from "./sections/SliceSection";
import FilterSection from "./sections/FilterSection";
import styles from "../../styles/CustomAnalysesPage.scss";

interface Props {
  analysis: PartialPearsonCorrelationConfiguration;
  dispatch: React.Dispatch<AnalysisReducerAction>;
}

function PearsonCorrelation({ analysis, dispatch }: Props) {
  return (
    <div className={styles.AnalysisConfigLayout}>
      <KindSection analysis={analysis} dispatch={dispatch} />
      <SliceSection analysis={analysis} dispatch={dispatch} />
      <DatasetSection analysis={analysis} dispatch={dispatch} />
      <FilterSection analysis={analysis} dispatch={dispatch} />
    </div>
  );
}

export default PearsonCorrelation;
