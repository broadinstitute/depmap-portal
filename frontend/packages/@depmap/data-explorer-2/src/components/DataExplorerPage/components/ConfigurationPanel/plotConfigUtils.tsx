import React from "react";
import { Button } from "react-bootstrap";
import {
  DataExplorerContextV2,
  DataExplorerPlotConfigDimensionV2,
  DimensionKey,
} from "@depmap/types";
import { PlotConfigReducerAction } from "../../reducers/plotConfigReducer";
import styles from "../../styles/ConfigurationPanel.scss";

export const getAxisLabel = (plot_type: string | undefined, axis: string) => {
  if (axis === "y" || plot_type === "waterfall") {
    return "Y Axis";
  }
  if (axis === "x" && plot_type === "scatter") {
    return "X Axis";
  }

  return "Axis";
};

export const CopyAxisButton = ({
  onClickCopyAxisConfig,
}: {
  onClickCopyAxisConfig: () => void;
}) => {
  return (
    <Button
      id="copy-axis-config"
      className={styles.copyAxisButton}
      onClick={onClickCopyAxisConfig}
    >
      <span>copy</span>
      <i className="glyphicon glyphicon-arrow-right" />
    </Button>
  );
};

export const SwapAxesButton = ({
  onClickSwapAxisConfigs,
}: {
  onClickSwapAxisConfigs: () => void;
}) => {
  return (
    <Button
      id="swap-axis-configs"
      className={styles.swapAxesButton}
      onClick={onClickSwapAxisConfigs}
    >
      <span>swap</span>
      <i className="glyphicon glyphicon-transfer" />
    </Button>
  );
};

// Routes an axis edit that involves expansion. Every such edit — turning
// expansion on, turning it off, or changing the gene/dataset of an axis that's
// already expanding — is one `select_expansion`, because the reducer has to
// see the whole thing at once: it decides whether this axis is defining the
// expansion or joining one, and keeps the plot-level `expand_by` in agreement
// with the defining axis.
//
// Notably this does NOT also dispatch `select_dimension`: `select_expansion`
// already writes the dimension, and a `select_dimension` afterwards would
// overwrite it with the raw selection — undoing the members a joining axis
// just inherited. Nor does it set `facet_by`/`color_by`; the reducer installs
// `facet_by: "expansion"` as a one-time default on the enable transition and
// clears it on the last axis leaving, and an absent `color_by` already means
// "match facet_by" (schema version 2). Setting them here would clobber a
// deliberate choice the user made afterward.
export const handleExpansionSelection = (
  key: DimensionKey,
  nextDimension: Partial<DataExplorerPlotConfigDimensionV2>,
  dispatch: (action: PlotConfigReducerAction) => void
) => {
  if (nextDimension.aggregation !== "expansion") {
    dispatch({
      type: "select_expansion",
      payload: { key, expand_by: null },
    });

    return;
  }

  dispatch({
    type: "select_expansion",
    payload: {
      key,
      expand_by: {
        slice_type: nextDimension.slice_type as string,
        context: nextDimension.context as DataExplorerContextV2,
        dataset_id: nextDimension.dataset_id as string,
        // `limit` and `offset` are deliberately omitted rather than reset:
        // the reducer seeds a default the first time, and re-issuing for an
        // unrelated edit (a different data version, say) must not throw the
        // user back to page one of a member set that hasn't changed.
      },
    },
  });
};
