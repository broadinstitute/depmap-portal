import React from "react";
import { Button } from "react-bootstrap";
import { DimensionSelectV2 } from "@depmap/data-explorer-2";
import Section from "@depmap/data-explorer-2/src/components/DataExplorerPage/components/Section";
import {
  ContextPath,
  DataExplorerPlotType,
  DataExplorerContextV2,
  DataExplorerPlotConfigDimensionV2,
  DimensionKey,
  PartialDataExplorerPlotConfig,
} from "@depmap/types";
import { isCompletePlot } from "@depmap/data-explorer-2/src/components/DataExplorerPage/validation";
import { PlotConfigReducerAction } from "@depmap/data-explorer-2/src/components/DataExplorerPage/reducers/plotConfigReducer";
import PlotTypeSelect from "./PlotTypeSelect";
import TranscriptExpansionSelect from "./TranscriptExpansionSelect";
import { DEFAULT_MAX_TRANSCRIPTS } from "../utils";
import styles from "../../styles/TranscriptPlotConfig.scss";

interface Props {
  plot: PartialDataExplorerPlotConfig;
  dispatch: (action: PlotConfigReducerAction) => void;
  onClickMakeScatter: () => void;
  onClickSwapAxisConfigs: () => void;
  onClickCreateContext: (path: ContextPath) => void;
  onClickSaveAsContext: (
    contextToEdit: DataExplorerContextV2,
    pathToSave: ContextPath
  ) => void;
}

function getGeneSymbol(
  plot: PartialDataExplorerPlotConfig,
  expansionAxis: "x" | "y"
) {
  if (!plot?.dimensions?.[expansionAxis]) {
    return null;
  }

  const dimension = plot.dimensions[expansionAxis];
  return dimension?.context?.name || null;
}

const getAxisLabel = (plot_type: string | undefined, axis: string) => {
  if (axis === "y" || plot_type === "waterfall") {
    return "Y Axis";
  }
  if (axis === "x" && plot_type === "scatter") {
    return "X Axis";
  }

  return "Axis";
};

const MakeScatterButton = ({
  onClickMakeScatter,
}: {
  onClickMakeScatter: () => void;
}) => {
  return (
    <Button className={styles.makeScatterButton} onClick={onClickMakeScatter}>
      <span>scatter</span>
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
    <Button className={styles.swapAxesButton} onClick={onClickSwapAxisConfigs}>
      <span>swap</span>
      <i className="glyphicon glyphicon-transfer" />
    </Button>
  );
};

function TranscriptPlotConfig({
  plot,
  dispatch,
  onClickMakeScatter,
  onClickSwapAxisConfigs,
  onClickCreateContext,
  onClickSaveAsContext,
}: Props) {
  const expansionAxis =
    plot.dimensions?.y?.aggregation === "expansion" ? "y" : "x";

  const expansion = plot.expand_by?.[0];

  return (
    <div className={styles.TranscriptPlotConfig}>
      <Section title="Transcript Explorer" defaultOpen>
        <PlotTypeSelect
          value={plot.plot_type || null}
          onChange={(nextPlotType) => {
            if (nextPlotType === plot.plot_type) {
              return;
            }

            // If the expansion axis moved to y, we need to put it back on x.
            const copyExpansion =
              expansionAxis === "y"
                ? {
                    type: "select_dimension",
                    payload: {
                      key: "x",
                      dimension: plot.dimensions!.y,
                    },
                  }
                : null;

            const setPlotType = {
              type: "select_plot_type",
              payload: nextPlotType as DataExplorerPlotType,
            } as any;

            // HACK: We'll make sure the regerssion line stays enabled for
            // the demo.
            const setShowRegressionLine = {
              type: "select_show_regression_line",
              payload: true,
            };

            const sortByAlpha =
              plot.plot_type === "scatter" && nextPlotType !== "scatter"
                ? {
                    type: "select_sort_by",
                    payload: "alphabetical",
                  }
                : null;

            dispatch({
              type: "batch",
              payload: [
                copyExpansion,
                setPlotType,
                setShowRegressionLine,
                sortByAlpha,
              ].filter(Boolean),
            });
          }}
        />
        <hr className={styles.hr} />
        <div className={styles.dimensions}>
          {(["x", "y"] as DimensionKey[])
            .filter((key) => plot.dimensions?.[key])
            .map((key) => {
              const showMakeScatterButton =
                key === "x" &&
                isCompletePlot(plot) &&
                plot.plot_type !== "scatter" &&
                plot.plot_type !== "correlation_heatmap";

              const showSwapButton =
                key === "x" && plot.plot_type === "scatter";

              const dimension = plot.dimensions![
                key
              ] as Partial<DataExplorerPlotConfigDimensionV2>;

              const path: ContextPath = ["dimensions", key, "context"];

              return (
                <div key={key}>
                  <label>{getAxisLabel(plot.plot_type, key)}</label>
                  {showMakeScatterButton && (
                    <MakeScatterButton
                      onClickMakeScatter={onClickMakeScatter}
                    />
                  )}
                  {showSwapButton && (
                    <SwapAxesButton
                      onClickSwapAxisConfigs={onClickSwapAxisConfigs}
                    />
                  )}
                  {key === expansionAxis ? (
                    <TranscriptExpansionSelect
                      key={key}
                      geneSymbol={getGeneSymbol(plot, key)}
                      expansionAxis={expansionAxis}
                      dimension={dimension}
                      limit={expansion?.limit ?? DEFAULT_MAX_TRANSCRIPTS}
                      offset={expansion?.offset ?? 0}
                      dispatch={dispatch}
                    />
                  ) : (
                    <DimensionSelectV2
                      index_type={plot.index_type as string}
                      allowNullFeatureType
                      value={
                        (dimension as DataExplorerPlotConfigDimensionV2) || null
                      }
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
                        const context = dimension.context;
                        onClickSaveAsContext(context!, path);
                      }}
                    />
                  )}
                </div>
              );
            })}
        </div>
      </Section>
    </div>
  );
}

export default TranscriptPlotConfig;
