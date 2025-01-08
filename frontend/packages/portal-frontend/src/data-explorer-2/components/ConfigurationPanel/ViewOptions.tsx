import React from "react";
import qs from "qs";
import {
  ContextPath,
  FilterKey,
  DataExplorerContext,
  PartialDataExplorerPlotConfig,
} from "@depmap/types";
import { PlotConfigReducerAction } from "src/data-explorer-2/reducers/plotConfigReducer";
import HelpTip from "src/data-explorer-2/components/HelpTip";
import Section from "src/data-explorer-2/components/Section";
import {
  ShowIdentityLineCheckbox,
  ShowPointsCheckbox,
  UseClusteringCheckbox,
} from "src/data-explorer-2/components/ConfigurationPanel/selectors";
import FilterViewOptions from "src/data-explorer-2/components/ConfigurationPanel/FilterViewOptions";
import ColorByViewOptions from "src/data-explorer-2/components/ConfigurationPanel/ColorByViewOptions";

interface Props {
  plot: PartialDataExplorerPlotConfig;
  dispatch: (action: PlotConfigReducerAction) => void;
  onClickCreateContext: (pathToCreate: ContextPath) => void;
  onClickSaveAsContext: (
    contextToEdit: DataExplorerContext,
    pathToSave: ContextPath
  ) => void;
}

const xDatasetEqualsYDataset = (plot: PartialDataExplorerPlotConfig) => {
  if (!plot.dimensions?.x?.dataset_id || !plot.dimensions?.y?.dataset_id) {
    return false;
  }

  return plot.dimensions.x.dataset_id === plot.dimensions.y.dataset_id;
};

function ViewOptions({
  plot,
  dispatch,
  onClickCreateContext,
  onClickSaveAsContext,
}: Props) {
  let filterKeys: FilterKey[] = [];

  if (plot.plot_type !== "correlation_heatmap" && plot.index_type !== "other") {
    filterKeys = ["visible"];
  }

  const params = qs.parse(window.location.search.substr(1));
  const defaultOpen = !params.task;

  return (
    <Section title="View Options" defaultOpen={defaultOpen}>
      <ShowPointsCheckbox
        show={plot.plot_type === "density_1d"}
        value={!plot.hide_points}
        onChange={(show_points: boolean) => {
          dispatch({
            type: "select_hide_points",
            payload: !show_points,
          });
        }}
      />
      <ShowIdentityLineCheckbox
        show={plot.plot_type === "scatter" && xDatasetEqualsYDataset(plot)}
        value={!plot.hide_identity_line}
        onChange={(showIdentityLine: boolean) => {
          dispatch({
            type: "select_hide_identity_line",
            payload: !showIdentityLine,
          });
        }}
      />
      <UseClusteringCheckbox
        show={plot.plot_type === "correlation_heatmap"}
        value={Boolean(plot.use_clustering)}
        onChange={(use_clustering: boolean) => {
          dispatch({
            type: "select_use_clustering",
            payload: use_clustering,
          });
        }}
      />
      <FilterViewOptions
        plot={plot}
        dispatch={dispatch}
        filterKeys={filterKeys}
        labels={[
          <span key={0}>
            Filter
            <HelpTip id="filter-help" />
          </span>,
        ]}
        onClickCreateContext={onClickCreateContext}
        onClickSaveAsContext={onClickSaveAsContext}
      />
      <ColorByViewOptions
        show={plot.plot_type !== "correlation_heatmap"}
        plot={plot}
        dispatch={dispatch}
        onClickCreateContext={onClickCreateContext}
        onClickSaveAsContext={onClickSaveAsContext}
      />
    </Section>
  );
}

export default ViewOptions;
