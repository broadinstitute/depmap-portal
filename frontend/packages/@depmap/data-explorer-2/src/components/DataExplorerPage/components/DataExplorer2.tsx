import React, { useEffect, useState } from "react";
import { PartialDataExplorerPlotConfig } from "@depmap/types";
import { DEFAULT_EMPTY_PLOT, readPlotFromQueryString } from "../utils";
import DataExplorer2MainContent from "./DataExplorer2MainContent";
import SpinnerOverlay from "./plot/SpinnerOverlay";
import styles from "../styles/DataExplorer2.scss";

interface PageProps {
  feedbackUrl: string | null;
  contactEmail: string;
  tutorialLink: string;
}

function DataExplorer2({ feedbackUrl, contactEmail, tutorialLink }: PageProps) {
  const [
    initialPlot,
    setInitialPlot,
  ] = useState<PartialDataExplorerPlotConfig | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const plot = await readPlotFromQueryString();
        setInitialPlot(plot);
      } catch (e) {
        window.console.error(e);
        setError(true);
      }
    })();
  }, []);

  return initialPlot ? (
    <DataExplorer2MainContent
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
          <button
            type="button"
            onClick={() => {
              window.history.replaceState(null, "", "./");
              setInitialPlot(DEFAULT_EMPTY_PLOT);
              setError(false);
            }}
          >
            Go back to Data Explorer
          </button>
        </div>
      )}
    </div>
  );
}

export default DataExplorer2;
