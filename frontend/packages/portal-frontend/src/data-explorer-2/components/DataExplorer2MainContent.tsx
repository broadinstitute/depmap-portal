/* eslint-disable @typescript-eslint/naming-convention */
import React, { useCallback, useEffect, useReducer, useState } from "react";
import {
  DEFAULT_EMPTY_PLOT,
  isCompletePlot,
  plotsAreEquivalentWhenSerialized,
  plotToQueryString,
  readPlotFromQueryString,
} from "src/data-explorer-2/utils";
import { useClickHandlers, useContextBuilder } from "src/data-explorer-2/hooks";
import {
  DataExplorerPlotConfig,
  PartialDataExplorerPlotConfig,
} from "@depmap/types";
import { logInitialPlot, logReducerTransform } from "src/data-explorer-2/debug";
import plotConfigReducer, {
  PlotConfigReducerAction,
} from "src/data-explorer-2/reducers/plotConfigReducer";
import NewVersionBanner from "src/data-explorer-2/components/NewVersionBanner";
import ConfigurationPanel from "src/data-explorer-2/components/ConfigurationPanel";
import VisualizationPanel from "src/data-explorer-2/components/VisualizationPanel";
import styles from "src/data-explorer-2/styles/DataExplorer2.scss";

interface Props {
  initialPlot: PartialDataExplorerPlotConfig;
  feedbackUrl: string | null;
  contactEmail: string;
  tutorialLink: string;
}

function DataExplorer2MainContent({
  initialPlot,
  feedbackUrl,
  contactEmail,
  tutorialLink,
}: Props) {
  useEffect(() => {
    logInitialPlot(initialPlot);
  }, [initialPlot]);

  const [isInitialPageLoad, setIsInitialPageLoad] = useState(
    initialPlot === DEFAULT_EMPTY_PLOT
  );
  const [plot, dispatchPlotAction] = useReducer(plotConfigReducer, initialPlot);

  const setPlot = (
    nextPlot:
      | DataExplorerPlotConfig
      | ((config: DataExplorerPlotConfig) => void)
  ) => dispatchPlotAction({ type: "set_plot", payload: nextPlot });

  const dispatchPlotActionAndUpdateHistory = useCallback(
    async (action: PlotConfigReducerAction) => {
      dispatchPlotAction(action);
      const nextPlot = plotConfigReducer(plot, action);
      logReducerTransform(action, plot, nextPlot);

      if (isCompletePlot(nextPlot)) {
        setIsInitialPageLoad(false);
        const prevPlot = await readPlotFromQueryString();

        if (!plotsAreEquivalentWhenSerialized(prevPlot, nextPlot)) {
          const queryString = await plotToQueryString(nextPlot);
          window.history.pushState(null, "", queryString);
        }
      }
    },
    [plot]
  );

  useEffect(() => {
    const onClickExample = (e: Event) => {
      dispatchPlotActionAndUpdateHistory({
        type: "set_plot",
        payload: (e as CustomEvent).detail,
      });
    };

    window.addEventListener("dx2_example_clicked", onClickExample);

    return () => {
      window.removeEventListener("dx2_example_clicked", onClickExample);
    };
  }, [dispatchPlotActionAndUpdateHistory]);

  useEffect(() => {
    const onPopState = (e: PopStateEvent) => {
      readPlotFromQueryString().then((nextPlot) => {
        setPlot(nextPlot);

        const initial = window.location.search.substr(1) === "";
        setIsInitialPageLoad(initial);

        if (e.state?.startScreenScrollTop) {
          const el = document.querySelector("#dx2_start_screen");
          el!.scroll(0, e.state.startScreenScrollTop);
        }
      });
    };

    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  const {
    ContextBuilder,
    onClickSaveAsContext,
    onClickCreateContext,
  } = useContextBuilder(plot, setPlot);

  const {
    handleClickSaveSelectionAsContext,
    handleClickVisualizeSelected,
    handleClickColorByContext,
    handleClickShowDensityFallback,
    handleClickCopyAxisConfig,
    handleClickSwapAxisConfigs,
  } = useClickHandlers(plot, setPlot, onClickSaveAsContext);

  return (
    <>
      <NewVersionBanner isInitialPageLoad={isInitialPageLoad} />
      <main className={styles.DataExplorer2}>
        <ConfigurationPanel
          plot={plot}
          dispatch={dispatchPlotActionAndUpdateHistory}
          onClickSaveAsContext={onClickSaveAsContext}
          onClickCreateContext={onClickCreateContext}
          onClickCopyAxisConfig={handleClickCopyAxisConfig}
          onClickSwapAxisConfigs={handleClickSwapAxisConfigs}
        />
        <VisualizationPanel
          plotConfig={isCompletePlot(plot) ? plot : null}
          isInitialPageLoad={isInitialPageLoad}
          onClickVisualizeSelected={handleClickVisualizeSelected}
          onClickSaveSelectionAsContext={handleClickSaveSelectionAsContext}
          onClickColorByContext={handleClickColorByContext}
          onClickShowDensityFallback={handleClickShowDensityFallback}
          feedbackUrl={feedbackUrl}
          contactEmail={contactEmail}
          tutorialLink={tutorialLink}
        />
      </main>
      <ContextBuilder />
    </>
  );
}

export default DataExplorer2MainContent;
