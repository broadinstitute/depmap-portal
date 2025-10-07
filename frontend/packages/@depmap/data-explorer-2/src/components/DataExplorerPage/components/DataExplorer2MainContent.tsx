import React, {
  useCallback,
  useEffect,
  useReducer,
  useRef,
  useState,
} from "react";
import { isBreadboxOnlyMode } from "../../../isBreadboxOnlyMode";
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
  useEffect(() => {
    logInitialPlot(initialPlot);
  }, [initialPlot]);

  const reactKey = useRef(0);

  const [isInitialPageLoad, setIsInitialPageLoad] = useState(
    initialPlot === DEFAULT_EMPTY_PLOT
  );
  const [plot, dispatchPlotAction] = useReducer(plotConfigReducer, initialPlot);

  const setPlot = (nextPlot: DataExplorerPlotConfig) =>
    dispatchPlotAction({ type: "set_plot", payload: nextPlot });

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
      // WORKAROUND: The DimensionSelectV2 has some very hacky internal state
      // that gets confused when you go from an uninitialized plot to a valid
      // plot like this. We'll work around this by forcing it to re-mount.
      reactKey.current++;

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
  } = useContextBuilder(plot as DataExplorerPlotConfig, setPlot);

  const {
    handleClickSaveSelectionAsContext,
    handleClickVisualizeSelected,
    handleClickColorByContext,
    handleClickShowDensityFallback,
    handleClickCopyAxisConfig,
    handleClickSwapAxisConfigs,
  } = useClickHandlers(
    plot as DataExplorerPlotConfig,
    setPlot,
    onClickSaveAsContext
  );

  return (
    <>
      <main
        className={styles.DataExplorer2}
        data-breadbox-only={isBreadboxOnlyMode}
      >
        <ConfigurationPanel
          key={reactKey.current}
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
