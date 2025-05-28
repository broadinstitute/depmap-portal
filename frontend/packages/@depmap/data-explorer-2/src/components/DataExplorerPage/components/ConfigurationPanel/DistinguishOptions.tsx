import React from "react";
import {
  PartialDataExplorerPlotConfig,
  DataExplorerContext,
  ContextPath,
} from "@depmap/types";
import { PlotConfigReducerAction } from "../../reducers/plotConfigReducer";
import Section from "../Section";
import FilterViewOptions from "./FilterViewOptions";
import styles from "../../styles/ConfigurationPanel.scss";

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
