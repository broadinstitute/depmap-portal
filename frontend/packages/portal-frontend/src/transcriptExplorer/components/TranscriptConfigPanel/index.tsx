import React from "react";
import {
  ContextPath,
  DataExplorerContextV2,
  PartialDataExplorerPlotConfig,
} from "@depmap/types";
import { PlotConfigReducerAction } from "@depmap/data-explorer-2/src/components/DataExplorerPage/reducers/plotConfigReducer";
import LinearRegressionInfo from "@depmap/data-explorer-2/src/components/DataExplorerPage/components/ConfigurationPanel/LinearRegressionInfo/index";
import ViewOptions from "@depmap/data-explorer-2/src/components/DataExplorerPage/components/ConfigurationPanel/ViewOptions";
import {
  makeHandlerForMakeScatter,
  makeHandlerForSwapAxisConfigs,
} from "../utils";
import TranscriptPlotConfig from "./TranscriptPlotConfig";
import DataExplorerLinks from "./DataExplorerLinks";
import TableViews from "./TableViews";
import styles from "@depmap/data-explorer-2/src/components/DataExplorerPage/styles/ConfigurationPanel.scss";

interface Props {
  plot: PartialDataExplorerPlotConfig;
  dispatch: (action: PlotConfigReducerAction) => void;
  canShowIdentityLine: boolean;
  onClickCreateContext: (path: ContextPath) => void;
  onClickSaveAsContext: (
    contextToEdit: DataExplorerContextV2,
    pathToSave: ContextPath
  ) => void;
}

function TranscriptConfigPanel({
  plot,
  dispatch,
  canShowIdentityLine,
  onClickCreateContext,
  onClickSaveAsContext,
}: Props) {
  const expansionAxis =
    plot.dimensions?.y?.aggregation === "expansion" ? "y" : "x";

  return (
    <div className={styles.ConfigurationPanel}>
      <TranscriptPlotConfig
        plot={plot}
        dispatch={dispatch}
        onClickCreateContext={onClickCreateContext}
        onClickSaveAsContext={onClickSaveAsContext}
        onClickMakeScatter={makeHandlerForMakeScatter(plot, dispatch)}
        onClickSwapAxisConfigs={makeHandlerForSwapAxisConfigs(
          plot,
          dispatch,
          expansionAxis
        )}
      />
      <ViewOptions
        plot={plot}
        dispatch={dispatch}
        canShowIdentityLine={canShowIdentityLine}
        onClickCreateContext={onClickCreateContext}
        onClickSaveAsContext={onClickSaveAsContext}
      />
      <TableViews plot={plot} expansionAxis={expansionAxis} />
      <DataExplorerLinks plot={plot} expansionAxis={expansionAxis} />
      <LinearRegressionInfo
        show={plot.plot_type === "scatter"}
        plot={plot}
        dispatch={dispatch}
      />
    </div>
  );
}

export default TranscriptConfigPanel;
