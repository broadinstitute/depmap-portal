import React, { useCallback, useEffect, useReducer } from "react";
import { isCompleteDimension } from "@depmap/data-explorer-2";
import { PartialDataExplorerPlotConfig } from "@depmap/types";
import { logInitialPlot, logReducerTransform } from "src/data-explorer-2/debug";
import plotConfigReducer, {
  PlotConfigReducerAction,
} from "src/data-explorer-2/reducers/plotConfigReducer";
import Config from "src/secretDataViewer/components/Config";
import Stats from "src/secretDataViewer/components/Stats";
import styles from "src/secretDataViewer/styles/DataViewer.scss";

const SHOW_DEV_CONTROLS = false;

const DEFAULT_PLOT: PartialDataExplorerPlotConfig = {
  plot_type: "density_1d",
  index_type: "depmap_model",
  dimensions: { x: {} },
};

function DataViewer() {
  const [plot, dispatch] = useReducer(plotConfigReducer, DEFAULT_PLOT);

  const dispatchAndLog = useCallback(
    async (action: PlotConfigReducerAction) => {
      dispatch(action);
      const nextPlot = plotConfigReducer(plot, action);
      logReducerTransform(action, plot, nextPlot);
    },
    [plot]
  );

  useEffect(() => {
    logInitialPlot(DEFAULT_PLOT);
  }, []);

  const simNav = () => {
    const nextPlot = {
      plot_type: "density_1d",
      index_type: "depmap_model",
      dimensions: {
        x: {
          axis_type: "aggregated_slice",
          aggregation: "mean",
          context: {
            context_type: "gene",
            name: "common essential",
            expr: {
              "==": [
                { var: "slice/gene_essentiality/all/label" },
                "common essential",
              ],
            },
          },
          dataset_id: "expression",
          slice_type: "gene",
        },
      },
    };

    dispatchAndLog({
      type: "set_plot",
      payload: nextPlot,
    });
  };

  const simPlotTypeChange = () => {
    dispatchAndLog({
      type: "select_plot_type",
      payload:
        plot.plot_type === "density_1d" ? "correlation_heatmap" : "density_1d",
    });
  };

  return (
    <div className={styles.DataViewer}>
      <div>
        {SHOW_DEV_CONTROLS && (
          <>
            <button type="button" onClick={simNav}>
              simulate navigation
            </button>
            <button type="button" onClick={simPlotTypeChange}>
              simulate plot type change
            </button>
          </>
        )}
        <Config plot={plot} dispatch={dispatchAndLog} />
        {SHOW_DEV_CONTROLS && isCompleteDimension(plot.dimensions.x) && (
          <div className={styles.complete}>complete dimension 👍</div>
        )}
      </div>
      <Stats index_type={plot.index_type} dimension={plot.dimensions.x} />
    </div>
  );
}

export default DataViewer;
