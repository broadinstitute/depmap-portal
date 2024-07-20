/* eslint-disable @typescript-eslint/naming-convention */
import React from "react";
import {
  PartialDataExplorerPlotConfig,
  DataExplorerContext,
  ContextPath,
} from "@depmap/types";
import { PlotConfigReducerAction } from "src/data-explorer-2/reducers/plotConfigReducer";
import Section from "src/data-explorer-2/components/Section";
import FilterViewOptions from "src/data-explorer-2/components/ConfigurationPanel/FilterViewOptions";
import styles from "src/data-explorer-2/styles/ConfigurationPanel.scss";

interface Props {
  show: boolean;
  plot: PartialDataExplorerPlotConfig;
  dispatch: (action: PlotConfigReducerAction) => void;
  onClickCreateContext: (pathToCreate: ContextPath) => void;
  onClickSaveAsContext: (
    contextToEdit: DataExplorerContext,
    pathToSave: ContextPath
  ) => void;
}

function DistinguishOptions({
  show,
  plot,
  dispatch,
  onClickCreateContext,
  onClickSaveAsContext,
}: Props) {
  if (!show) {
    return null;
  }

  return (
    <Section title="Distinguish">
      <div className={styles.distinguishOptions}>
        <FilterViewOptions
          plot={plot}
          dispatch={dispatch}
          labels={[null, "from"]}
          includeAllInOptions
          filterKeys={["distinguish1", "distinguish2"]}
          onClickCreateContext={onClickCreateContext}
          onClickSaveAsContext={onClickSaveAsContext}
        />
      </div>
    </Section>
  );
}

export default DistinguishOptions;
