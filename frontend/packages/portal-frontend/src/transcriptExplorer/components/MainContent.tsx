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
} from "@depmap/data-explorer-2/src/components/DataExplorerPage/hooks";
import VisualizationPanel from "@depmap/data-explorer-2/src/components/DataExplorerPage/components/VisualizationPanel";
import {
  logDirectPlotChange,
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

const NOOP = () => {};

function MainContent({
  initialPlot,
  feedbackUrl,
  contactEmail,
  tutorialLink,
}: Props) {
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

  const canShowIdentityLine = useCanShowIdentityLine(
    plot?.dimensions?.x?.dataset_id,
    plot?.dimensions?.y?.dataset_id
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
          onClickVisualizeSelected={NOOP}
          onClickSaveSelectionAsContext={NOOP}
          onClickColorByContext={NOOP}
          onClickShowDensityFallback={NOOP}
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
