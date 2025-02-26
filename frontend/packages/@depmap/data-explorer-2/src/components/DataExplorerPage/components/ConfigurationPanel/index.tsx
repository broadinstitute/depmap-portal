import React from "react";
import {
  ContextPath,
  DataExplorerContext,
  PartialDataExplorerPlotConfig,
} from "@depmap/types";
import { PlotConfigReducerAction } from "../../reducers/plotConfigReducer";
import PlotConfiguration from "./PlotConfiguration";
import AnalysisResult from "./AnalysisResult";
import ViewOptions from "./ViewOptions";
import LinearRegressionInfo from "./LinearRegressionInfo";
import PrecomputedAssociations from "./PrecomputedAssociations";
import DistinguishOptions from "./DistinguishOptions";
import styles from "../../styles/ConfigurationPanel.scss";

interface Props {
  plot: PartialDataExplorerPlotConfig;
  dispatch: (action: PlotConfigReducerAction) => void;
  onClickCreateContext: (path: ContextPath) => void;
  onClickSaveAsContext: (
    contextToEdit: DataExplorerContext,
    pathToSave: ContextPath
  ) => void;
  onClickCopyAxisConfig: () => void;
  onClickSwapAxisConfigs: () => void;
}

function ConfigurationPanel({
  plot,
  dispatch,
  onClickCreateContext,
  onClickSaveAsContext,
  onClickCopyAxisConfig,
  onClickSwapAxisConfigs,
}: Props) {
  const showAssocations = Boolean(
    plot.index_type === "depmap_model" &&
      plot.dimensions?.x &&
      plot.dimensions.x.context &&
      plot.dimensions.x.dataset_id &&
      plot.dimensions.x.axis_type === "raw_slice" &&
      ["gene", "compound_experiment"].includes(
        plot.dimensions.x.slice_type as string
      )
  );

  return (
    <div className={styles.ConfigurationPanel}>
      <AnalysisResult plot={plot} dispatch={dispatch} />
      <PlotConfiguration
        plot={plot}
        dispatch={dispatch}
        onClickCreateContext={onClickCreateContext}
        onClickSaveAsContext={onClickSaveAsContext}
        onClickCopyAxisConfig={onClickCopyAxisConfig}
        onClickSwapAxisConfigs={onClickSwapAxisConfigs}
      />
      <ViewOptions
        plot={plot}
        dispatch={dispatch}
        onClickCreateContext={onClickCreateContext}
        onClickSaveAsContext={onClickSaveAsContext}
      />
      <PrecomputedAssociations
        show={showAssocations}
        plot={plot}
        dispatch={dispatch}
      />
      <LinearRegressionInfo
        show={plot.plot_type === "scatter"}
        plot={plot}
        dispatch={dispatch}
      />
      <DistinguishOptions
        show={
          plot.plot_type === "correlation_heatmap" &&
          plot.index_type !== "other"
        }
        plot={plot}
        dispatch={dispatch}
        onClickCreateContext={onClickCreateContext}
        onClickSaveAsContext={onClickSaveAsContext}
      />
    </div>
  );
}

export default ConfigurationPanel;
