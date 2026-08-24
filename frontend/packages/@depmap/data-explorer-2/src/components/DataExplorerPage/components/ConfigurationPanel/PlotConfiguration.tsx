import React from "react";
import qs from "qs";
import DimensionSelectV2 from "../../../DimensionSelectV2";
import {
  ContextPath,
  DataExplorerContextV2,
  DataExplorerPlotConfigDimensionV2,
  DataExplorerPlotType,
  DimensionKey,
  PartialDataExplorerPlotConfig,
} from "@depmap/types";
import { isCompletePlot } from "../../validation";
import { getExpansionAxes } from "../../../../utils/misc";
import { PlotConfigReducerAction } from "../../reducers/plotConfigReducer";
import Section from "../Section";
import { PlotTypeSelector, PointsSelector } from "./selectors";
import {
  CopyAxisButton,
  SwapAxesButton,
  getAxisLabel,
  handleExpansionSelection,
} from "./plotConfigUtils";
import styles from "../../styles/ConfigurationPanel.scss";

interface Props {
  plot: PartialDataExplorerPlotConfig;
  dispatch: (action: PlotConfigReducerAction) => void;
  onClickCreateContext: (path: ContextPath) => void;
  onClickSaveAsContext: (
    contextToEdit: DataExplorerContextV2,
    pathToSave: ContextPath
  ) => void;
  onClickCopyAxisConfig: () => void;
  onClickSwapAxisConfigs: () => void;
}

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

  const expandBy = plot.expand_by?.[0];

  const axisKeys = (["x", "y"] as DimensionKey[]).filter(
    (key) => plot.dimensions?.[key]
  );

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
      <div
        className={styles.dimensions}
        style={{
          gridTemplateColumns: `repeat(${axisKeys.length}, minmax(0, 1fr))`,
        }}
      >
        {axisKeys.map((key) => {
          const path: ContextPath = ["dimensions", key, "context"];
          const dimension = plot.dimensions![
            key
          ] as Partial<DataExplorerPlotConfigDimensionV2>;

          const showSwapButton = key === "x" && plot.plot_type === "scatter";

          const showCopyButton =
            key === "x" &&
            isCompletePlot(plot) &&
            ["density_1d", "waterfall"].includes(plot.plot_type);

          // The expansion, if any, that some axis OTHER than this one has
          // defined. `expand_by` is the plot-level record of it, so this is
          // just "is anyone else expanding?" — this axis may then join that
          // expansion (same members, its own dataset) but never start a
          // rival one.
          const otherAxisExpansion =
            getExpansionAxes(plot).some((k) => k !== key) && expandBy
              ? { slice_type: expandBy.slice_type as string }
              : null;

          return (
            // Exactly ONE grid item per axis. Its contents reach the shared
            // rows via subgrid rather than by being grid items of
            // `.dimensions` themselves — see `.axisColumn` for why that
            // distinction matters.
            <div className={styles.axisColumn} key={key}>
              <div className={styles.axisHeader}>
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
              </div>
              <DimensionSelectV2
                asGridRows
                index_type={plot.index_type as string}
                allowNullFeatureType
                allowExpansion={plot.plot_type !== "correlation_heatmap"}
                otherAxisExpansion={otherAxisExpansion}
                value={(dimension as DataExplorerPlotConfigDimensionV2) || null}
                onChange={(nextDimension) => {
                  if (
                    dimension.aggregation === "expansion" ||
                    nextDimension?.aggregation === "expansion"
                  ) {
                    handleExpansionSelection(key, nextDimension, dispatch);
                  } else {
                    dispatch({
                      type: "select_dimension",
                      payload: { key, dimension: nextDimension },
                    });
                  }
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
                  const context = dimension.context;
                  onClickSaveAsContext(context!, path);
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
