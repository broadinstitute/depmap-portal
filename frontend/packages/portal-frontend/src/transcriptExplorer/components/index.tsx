import React, { useEffect, useState } from "react";
import { PartialDataExplorerPlotConfig } from "@depmap/types";
import {
  DEFAULT_EMPTY_PLOT,
  readPlotFromQueryString,
} from "@depmap/data-explorer-2/src/components/DataExplorerPage/utils";
import SpinnerOverlay from "@depmap/data-explorer-2/src/components/DataExplorerPage/components/plot/SpinnerOverlay";
import { EMPTY_TRANSCRIPT_PLOT, focusWhenElementReady } from "./utils";
import MainContent from "./MainContent";
import styles from "../styles/TranscriptPlotConfig.scss";

interface Props {
  feedbackUrl: string | null;
  contactEmail: string;
  tutorialLink: string;
}

function TranscriptExplorerPage({
  feedbackUrl,
  contactEmail,
  tutorialLink,
}: Props) {
  const [
    initialPlot,
    setInitialPlot,
  ] = useState<PartialDataExplorerPlotConfig | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        let plot = await readPlotFromQueryString();

        if (plot === DEFAULT_EMPTY_PLOT) {
          plot = EMPTY_TRANSCRIPT_PLOT;
          focusWhenElementReady(`.${styles.geneSelect} input`);
        }

        setInitialPlot(plot);
      } catch (e) {
        window.console.error(e);
        setError(true);
      }
    })();
  }, []);

  return initialPlot ? (
    <MainContent
      initialPlot={initialPlot}
      feedbackUrl={feedbackUrl}
      contactEmail={contactEmail}
      tutorialLink={tutorialLink}
    />
  ) : (
    <div className={styles.initialLoadingSpinner}>
      {!error && <SpinnerOverlay />}
      {error && (
        <div className={styles.initialLoadError}>
          <h1>Sorry, an error occurred</h1>
          <p>There was an error loading this plot.</p>
        </div>
      )}
    </div>
  );
}

export default TranscriptExplorerPage;
