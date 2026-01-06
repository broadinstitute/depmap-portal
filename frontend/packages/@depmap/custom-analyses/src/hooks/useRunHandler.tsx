import React, { useEffect, useState } from "react";
import cx from "classnames";
import { breadboxAPI } from "@depmap/api";
import {
  promptForValue,
  PromptComponentProps,
} from "@depmap/common-components";
import { ComputeResponseResult } from "@depmap/compute";
import {
  runPearsonCorrelationAnalysis,
  runTwoClassComparisonAnalysis,
} from "../api";
import { AnalysisConfiguration } from "../types/AnalysisConfiguration";
import getAnalysisKindDisplayName from "../utils/getAnalysisKindDisplayName";
import getDataExplorerLink from "../utils/getDataExplorerLink";
import ProgressTracker from "./ProgressTracker";
import styles from "../styles/CustomAnalysesPage.scss";

const run = (analysis: AnalysisConfiguration) => {
  if (analysis.kind === "pearson_correlation") {
    const { datasetId, sliceQuery, filterByContext } = analysis;

    return runPearsonCorrelationAnalysis({
      datasetId,
      sliceQuery,
      filterByContext,
    });
  }

  if (analysis.kind === "two_class_comparison") {
    const { datasetId, inGroupContext, outGroupContext } = analysis;

    return runTwoClassComparisonAnalysis({
      datasetId,
      inGroupContext,
      outGroupContext,
    });
  }

  throw new Error(
    `Analysis kind ${(analysis as AnalysisConfiguration).kind} not implemented`
  );
};

// This cache stores the task ID of any configuration that's already been run.
type ConfigJson = string;
type TaskId = string;
const cache: Record<ConfigJson, TaskId> = {};

const ResultsReady = () => {
  const [fadeIn, setFadeIn] = useState(false);

  useEffect(() => {
    setFadeIn(true);
  }, []);

  return (
    <div className={cx(styles.result, { [styles.fadeIn]: fadeIn })}>
      <span className="glyphicon glyphicon-ok-circle" />
      <p>Custom analysis results are ready to view.</p>
    </div>
  );
};

const launchModal = (analysis: AnalysisConfiguration, done: () => void) => {
  const cacheKey = JSON.stringify(analysis);

  const getTaskStatus = () => {
    if (cacheKey in cache) {
      return breadboxAPI.getTaskStatus(cache[cacheKey]);
    }

    return run(analysis).then((task) => {
      cache[cacheKey] = task.id;
      return task;
    });
  };

  function PromptComponent({
    value,
    onChange,
  }: PromptComponentProps<ComputeResponseResult>) {
    return (
      <div className={cx(styles.modal, { [styles.success]: Boolean(value) })}>
        <ProgressTracker
          getTaskStatus={getTaskStatus}
          onSuccess={(task) => {
            onChange(task.result as ComputeResponseResult);
            done();
          }}
          onFailure={() => {
            delete cache[cacheKey]; // make sure we can retry on fail
            done();
          }}
          onCancel={done}
          getDebugInfo={() => (
            <div>
              <hr />
              <p>Analysis configuration:</p>
              <pre style={{ maxHeight: 500, overflow: "auto" }}>
                <code>{JSON.stringify(analysis, null, 2)}</code>
              </pre>
            </div>
          )}
        />
        {value && <ResultsReady />}
      </div>
    );
  }

  return promptForValue({
    title: `Running ${getAnalysisKindDisplayName(analysis.kind)}`,
    acceptButtonText: "Open in Data Explorer",
    PromptComponent,
  });
};

function useRunHandler(analysis: AnalysisConfiguration) {
  const [isRunning, setIsRunning] = useState(false);

  const handleClickRunAnalysis = async () => {
    setIsRunning(true);
    const result = await launchModal(analysis, () => setIsRunning(false));

    if (result) {
      const link = await getDataExplorerLink(analysis, result);
      window.open(link, "_blank");
    }
  };

  return { isRunning, handleClickRunAnalysis };
}

export default useRunHandler;
