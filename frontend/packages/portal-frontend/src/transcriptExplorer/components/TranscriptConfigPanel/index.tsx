import React from "react";
import {
  ContextPath,
  DataExplorerContextV2,
  PartialDataExplorerPlotConfig,
} from "@depmap/types";
import { PlotConfigReducerAction } from "@depmap/data-explorer-2/src/components/DataExplorerPage/reducers/plotConfigReducer";
import LinearRegressionInfo from "@depmap/data-explorer-2/src/components/DataExplorerPage/components/ConfigurationPanel/LinearRegressionInfo/index";
import { makeSetExpansionAction, DEFAULT_MAX_TRANSCRIPTS } from "../utils";
import TranscriptPlotConfig from "./TranscriptPlotConfig";
import TranscriptViewOptions from "./TranscriptViewOptions";
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
        onClickMakeScatter={() => {
          const setScatter = { type: "select_plot_type", payload: "scatter" };
          const geneSymbol = plot.dimensions!.x!.context!.name;

          const setRegLine = {
            type: "select_show_regression_line",
            payload: true,
          };

          const makeY = {
            type: "select_dimension",
            payload: {
              key: "y",
              dimension: {
                axis_type: "raw_slice",
                aggregation: "first",
                slice_type: "gene",
                dataset_id: "expression",
                context: {
                  dimension_type: "gene",
                  name: geneSymbol,
                  expr: { "==": [{ var: "entity_label" }, geneSymbol] },
                  vars: {
                    symbol: {
                      dataset_id: "gene_metadata",
                      identifier_type: "column",
                      identifier: "label",
                    },
                  },
                },
              },
            },
          } as any;

          dispatch({ type: "batch", payload: [setScatter, makeY, setRegLine] });
        }}
        onClickSwapAxisConfigs={() => {
          const geneSymbol = plot.dimensions?.[expansionAxis]?.context?.name;
          const dataset_id = plot.dimensions?.[expansionAxis]?.dataset_id;

          if (!geneSymbol || !dataset_id) {
            return;
          }

          const nextExpansionAxis = expansionAxis === "x" ? "y" : "x";

          // Same gene and dataset — only the axis changes — so the transcript
          // set is identical; preserve both the page size and the window.
          const expansion = plot.expand_by?.[0];

          const setExpansion = makeSetExpansionAction(
            nextExpansionAxis,
            geneSymbol,
            dataset_id,
            expansion?.limit ?? DEFAULT_MAX_TRANSCRIPTS,
            expansion?.offset ?? 0
          ) as any;

          const setOtherAxis = {
            type: "select_dimension",
            payload: {
              key: expansionAxis,
              dimension: plot.dimensions![nextExpansionAxis],
            },
          };

          dispatch({ type: "batch", payload: [setExpansion, setOtherAxis] });
        }}
      />
      <TranscriptViewOptions
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
