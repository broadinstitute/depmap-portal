import React, { useReducer } from "react";
import { Spinner } from "@depmap/common-components";
import { analysisReducer } from "../reducers/analysisReducer";
import useAnalysisQueryString from "../hooks/useAnalysisQueryString";
import { AnalysisConfiguration } from "../types/AnalysisConfiguration";
import AnalysisConfigurationPanel from "./AnalysisConfigurationPanel";
import RunAnalysisButton from "./RunAnalysisButton";
import styles from "../styles/CustomAnalysesPage.scss";

const DEFAULT_EMPTY_ANALYSIS: Partial<AnalysisConfiguration> = {
  index_type: "depmap_model",
};

function CustomAnalysesPage() {
  const [analysis, dispatch] = useReducer(
    analysisReducer,
    DEFAULT_EMPTY_ANALYSIS
  );

  const { syncedDispatch, isHydrating } = useAnalysisQueryString(
    analysis,
    dispatch
  );

  return (
    <main className={styles.CustomAnalysesPage}>
      <div className={styles.CustomAnalysesTitle}>
        <h1>Custom Analyses</h1>
      </div>
      {isHydrating ? (
        <Spinner position="static" />
      ) : (
        <>
          <div className={styles.AnalysisConfigurationPanel}>
            <AnalysisConfigurationPanel
              analysis={analysis}
              dispatch={syncedDispatch}
            />
          </div>
          <div className={styles.CustomAnalysesControls}>
            <RunAnalysisButton analysis={analysis} />
          </div>
        </>
      )}
    </main>
  );
}

export default CustomAnalysesPage;
