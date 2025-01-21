import React, { useCallback, useEffect, useReducer, useState } from "react";
import { useDeprecatedDataExplorerApi } from "../../../contexts/DeprecatedDataExplorerApiContext";
import {
  DEFAULT_EMPTY_PLOT,
  plotsAreEquivalentWhenSerialized,
  plotToQueryString,
  readPlotFromQueryString,
} from "../utils";
import { isCompletePlot } from "../validation";
import { useClickHandlers, useContextBuilder } from "../hooks";
import {
  DataExplorerPlotConfig,
  PartialDataExplorerPlotConfig,
} from "@depmap/types";
import { logInitialPlot, logReducerTransform } from "../debug";
import plotConfigReducer, {
  PlotConfigReducerAction,
} from "../reducers/plotConfigReducer";
import NewVersionBanner from "./NewVersionBanner";
import ConfigurationPanel from "./ConfigurationPanel";
import VisualizationPanel from "./VisualizationPanel";
import styles from "../styles/DataExplorer2.scss";

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
  const api = useDeprecatedDataExplorerApi();

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
        const prevPlot = await readPlotFromQueryString(api);

        if (!plotsAreEquivalentWhenSerialized(prevPlot, nextPlot)) {
          const queryString = await plotToQueryString(nextPlot);
          window.history.pushState(null, "", queryString);
        }
      }
    },
    [api, plot]
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
      readPlotFromQueryString(api).then((nextPlot) => {
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
  }, [api]);

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
