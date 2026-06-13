import React from "react";
import { ContextPath, DataExplorerContextV2 } from "@depmap/types";
import { PlotConfigReducerAction } from "@depmap/data-explorer-2/src/components/DataExplorerPage/reducers/plotConfigReducer";
import { SortBySelector } from "@depmap/data-explorer-2/src/components/DataExplorerPage/components/ConfigurationPanel/selectors";
import TranscriptGroupByTypeSelect from "./TranscriptGroupByTypeSelect";
import styles from "../../../styles/TranscriptPlotConfig.scss";

// HACK (DEFERRED-GROUP-BY-MODES): the only wired group_by value is "expansion"
// (Transcript), so this panel offers just that — clearable, which hands
// grouping back to color_by via the pre-existing `group_by ?? color_by`
// coupling. The property and custom modes (their ColorByAnnotation/
// ColorByDimension selects, select_group_property, and a `group`
// dimension/group1 filter) are deferred until group_by is an axis independent
// of color_by. onClickCreateContext/onClickSaveAsContext stay on Props for
// when those branches return.

interface Props {
  show: boolean;
  plot: any;
  dispatch: (action: PlotConfigReducerAction) => void;
  // eslint-disable-next-line
  onClickCreateContext: (pathToCreate: ContextPath) => void;
  // eslint-disable-next-line
  onClickSaveAsContext: (
    contextToEdit: DataExplorerContextV2,
    pathToSave: ContextPath
  ) => void;
}

function TranscriptGroupByViewOptions({ show, plot, dispatch }: Props) {
  if (!show) {
    return null;
  }

  const { index_type, group_by, sort_by, plot_type } = plot;

  return (
    <div className={styles.TranscriptGroupByViewOptions}>
      <TranscriptGroupByTypeSelect
        enable={Boolean(index_type)}
        value={group_by || null}
        onChange={(nextGroupBy) =>
          dispatch({
            type: "select_group_by",
            payload: nextGroupBy,
          })
        }
      />
      <SortBySelector
        show={
          group_by === "expansion" &&
          ["density_1d", "waterfall"].includes(plot_type)
        }
        enable
        value={sort_by}
        onChange={(next_sort_by) => {
          dispatch({
            type: "select_sort_by",
            payload: next_sort_by,
          });
        }}
      />
    </div>
  );
}

export default TranscriptGroupByViewOptions;
