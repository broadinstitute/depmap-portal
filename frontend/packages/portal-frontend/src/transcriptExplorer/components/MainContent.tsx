import React, { useCallback, useEffect, useRef, useReducer } from "react";
import {
  DataExplorerPlotConfig,
  PartialDataExplorerPlotConfig,
} from "@depmap/types";
import plotConfigReducer, {
  PlotConfigReducerAction,
} from "@depmap/data-explorer-2/src/components/DataExplorerPage/reducers/plotConfigReducer";
import {
  plotsAreEquivalentWhenSerialized,
  plotToQueryString,
  readPlotFromQueryString,
} from "@depmap/data-explorer-2/src/components/DataExplorerPage/utils";
import { isCompletePlot } from "@depmap/data-explorer-2/src/components/DataExplorerPage/validation";
import {
  useCanShowIdentityLine,
  useContextBuilder,
  useClickHandlers,
} from "@depmap/data-explorer-2/src/components/DataExplorerPage/hooks";
import VisualizationPanel from "@depmap/data-explorer-2/src/components/DataExplorerPage/components/VisualizationPanel";
import {
  logDirectPlotChange,
  logInitialPlot,
  logReducerTransform,
} from "@depmap/data-explorer-2/src/components/DataExplorerPage/debug";
import TranscriptConfigPanel from "./TranscriptConfigPanel";
import styles from "@depmap/data-explorer-2/src/components/DataExplorerPage/styles/DataExplorer2.scss";
import { EMPTY_TRANSCRIPT_PLOT } from "./utils";

interface Props {
  initialPlot: PartialDataExplorerPlotConfig;
  feedbackUrl: string | null;
  contactEmail: string;
  tutorialLink: string;
}

function MainContent({
  initialPlot,
  feedbackUrl,
  contactEmail,
  tutorialLink,
}: Props) {
  useEffect(() => {
    logInitialPlot(initialPlot);
  }, [initialPlot]);

  const reactKey = useRef(0);
  const [plot, dispatchPlotAction] = useReducer(plotConfigReducer, initialPlot);

  const setPlot = (nextPlot: DataExplorerPlotConfig) =>
    dispatchPlotAction({ type: "set_plot", payload: nextPlot });

  const dispatchPlotActionAndUpdateHistory = useCallback(
    async (action: PlotConfigReducerAction) => {
      dispatchPlotAction(action);
      const nextPlot = plotConfigReducer(plot, action);
      logReducerTransform(action, plot, nextPlot);

      if (isCompletePlot(nextPlot)) {
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
    const onPopState = () => {
      readPlotFromQueryString().then((nextPlot) => {
        if (nextPlot === EMPTY_TRANSCRIPT_PLOT) {
          reactKey.current++;
        }

        setPlot(nextPlot);
        logDirectPlotChange("onPopState", plot, nextPlot);
      });
    };

    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [plot]);

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
  } = useClickHandlers(
    plot as DataExplorerPlotConfig,
    setPlot,
    onClickSaveAsContext
  );

  const canShowIdentityLine = useCanShowIdentityLine(
    plot?.dimensions?.x?.dataset_id,
    plot?.dimensions?.y?.dataset_id
  );

  // Same route back into the config the Data Explorer's own MainContent uses:
  // the picker lives beside the legend, which has no dispatch of its own.
  const handleChangeExpansionMembers = useCallback(
    (members: string[] | null) => {
      dispatchPlotActionAndUpdateHistory({
        type: "select_expansion_members",
        payload: members,
      });
    },
    [dispatchPlotActionAndUpdateHistory]
  );

  const handleChangeCategories = useCallback(
    (target: "color" | "facet", categories: string[] | null) => {
      dispatchPlotActionAndUpdateHistory({
        type: "select_categories",
        payload: { target, categories },
      });
    },
    [dispatchPlotActionAndUpdateHistory]
  );

  return (
    <>
      <main className={styles.DataExplorer2}>
        <TranscriptConfigPanel
          plot={plot}
          dispatch={dispatchPlotActionAndUpdateHistory}
          canShowIdentityLine={canShowIdentityLine}
          onClickCreateContext={onClickCreateContext}
          onClickSaveAsContext={onClickSaveAsContext}
        />
        <VisualizationPanel
          plotConfig={isCompletePlot(plot) ? plot : null}
          isInitialPageLoad={false}
          onClickVisualizeSelected={handleClickVisualizeSelected}
          onClickSaveSelectionAsContext={handleClickSaveSelectionAsContext}
          onClickColorByContext={handleClickColorByContext}
          onChangeCategories={handleChangeCategories}
          onChangeExpansionMembers={handleChangeExpansionMembers}
          onClickShowDensityFallback={handleClickShowDensityFallback}
          feedbackUrl={feedbackUrl}
          contactEmail={contactEmail}
          tutorialLink={tutorialLink}
          canShowIdentityLine={canShowIdentityLine}
        />
        <ContextBuilder />
      </main>
    </>
  );
}

export default MainContent;
