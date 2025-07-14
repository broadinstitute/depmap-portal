import React from "react";
import qs from "qs";
import cx from "classnames";
import { Button } from "react-bootstrap";
import { isElara } from "@depmap/globals";
import DimensionSelectV1 from "../../../DimensionSelect";
import DimensionSelectV2 from "../../../DimensionSelectV2";
import {
  ContextPath,
  DataExplorerContext,
  DataExplorerPlotConfigDimension,
  DataExplorerPlotType,
  DimensionKey,
  PartialDataExplorerPlotConfig,
} from "@depmap/types";
import { isCompletePlot } from "../../validation";
import { PlotConfigReducerAction } from "../../reducers/plotConfigReducer";
import { PlotTypeSelector, PointsSelector } from "./selectors";
import Section from "../Section";
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

const DimensionSelect = isElara
  ? ((DimensionSelectV2 as unknown) as typeof DimensionSelectV1)
  : DimensionSelectV1;

const getAxisLabel = (plot_type: string | undefined, axis: string) => {
  if (axis === "y" || plot_type === "waterfall") {
    return "Y Axis";
  }
  if (axis === "x" && plot_type === "scatter") {
    return "X Axis";
  }

  return "Axis";
};

const CopyAxisButton = ({
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

const SwapAxesButton = ({
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

function PlotConfiguration({
  plot,
  dispatch,
  onClickCreateContext,
  onClickSaveAsContext,
  onClickCopyAxisConfig,
  onClickSwapAxisConfigs,
}: Props) {
  const params = qs.parse(window.location.search.substr(1));
  const defaultOpen = !params.task;

  return (
    <Section title="Plot Configuration" defaultOpen={defaultOpen}>
      <PlotTypeSelector
        value={plot.plot_type || null}
        onChange={(plot_type) =>
          dispatch({
            type: "select_plot_type",
            payload: plot_type as DataExplorerPlotType,
          })
        }
      />
      <PointsSelector
        show
        enable={plot.plot_type}
        value={plot.index_type}
        plot_type={plot.plot_type}
        onChange={(index_type: string) =>
          dispatch({
            type: "select_index_type",
            payload: index_type,
          })
        }
      />
      <hr className={styles.hr} />
      <div className={styles.dimensions}>
        {(["x", "y"] as DimensionKey[])
          .filter((key) => plot.dimensions?.[key])
          .map((key) => {
            const showSwapButton = key === "x" && plot.plot_type === "scatter";

            const showCopyButton =
              key === "x" &&
              isCompletePlot(plot) &&
              ["density_1d", "waterfall"].includes(plot.plot_type) &&
              plot.index_type !== "other";

            const dimension = plot.dimensions![
              key
            ] as Partial<DataExplorerPlotConfigDimension>;
            const path: ContextPath = ["dimensions", key, "context"];

            const onlyParallelAxisHasAggregation =
              dimension.axis_type === "raw_slice" &&
              plot.dimensions![key === "x" ? "y" : "x"]?.axis_type ===
                "aggregated_slice";

            return (
              <div key={key}>
                {plot.plot_type !== "correlation_heatmap" && (
                  <label>{getAxisLabel(plot.plot_type, key)}</label>
                )}
                {showCopyButton && (
                  <CopyAxisButton
                    onClickCopyAxisConfig={onClickCopyAxisConfig}
                  />
                )}
                {showSwapButton && (
                  <SwapAxesButton
                    onClickSwapAxisConfigs={onClickSwapAxisConfigs}
                  />
                )}
                <DimensionSelect
                  className={cx({
                    [styles.dimensionWithGap]: onlyParallelAxisHasAggregation,
                  })}
                  index_type={plot.index_type || null}
                  value={dimension || null}
                  onChange={(nextDimension) => {
                    dispatch({
                      type: "select_dimension",
                      payload: { key, dimension: nextDimension },
                    });
                  }}
                  mode={
                    plot.plot_type === "correlation_heatmap"
                      ? "context-only"
                      : "entity-or-context"
                  }
                  includeAllInContextOptions={
                    plot.plot_type !== "correlation_heatmap"
                  }
                  onClickCreateContext={() => onClickCreateContext(path)}
                  onClickSaveAsContext={() => {
                    const context = dimension.context as DataExplorerContext;
                    onClickSaveAsContext(context, path);
                  }}
                />
              </div>
            );
          })}
      </div>
    </Section>
  );
}

export default PlotConfiguration;
