import React, { useEffect, useState } from "react";
import {
  DataExplorerApiProvider,
  fetchContextLabels,
  fetchDatasetDetails,
  fetchDatasetsByIndexType,
  fetchDatasetsMatchingContextIncludingEntities,
  fetchDimensionLabels,
  fetchDimensionLabelsOfDataset,
  fetchDimensionLabelsToDatasetsMapping,
} from "@depmap/data-explorer-2";
import { PartialDataExplorerPlotConfig } from "@depmap/types";
import {
  convertLegacyContexts,
  readPlotFromQueryString,
  DEFAULT_EMPTY_PLOT,
} from "src/data-explorer-2/utils";
import DataExplorer2MainContent from "src/data-explorer-2/components/DataExplorer2MainContent";
import SpinnerOverlay from "src/data-explorer-2/components/plot/SpinnerOverlay";
import styles from "src/data-explorer-2/styles/DataExplorer2.scss";

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
        // Prior to the 23Q2 release, contexts were saved to local storage. Now
        // only the hashes reside there and the actual content is persisted to
        // a bucket. These two formats are incompatible (with a different
        // hashing method) so we do one big wholesale conversion before trying
        // to load anything. This can probably be removed after a reasonable
        // amount of time has gone by.
        await convertLegacyContexts();

        const plot = await readPlotFromQueryString();
        setInitialPlot(plot);
      } catch (e) {
        window.console.error(e);
        setError(true);
      }
    })();
  }, []);

  return initialPlot ? (
    <DataExplorerApiProvider
      evaluateLegacyContext={fetchContextLabels}
      fetchDatasetDetails={fetchDatasetDetails}
      fetchDatasetsByIndexType={fetchDatasetsByIndexType}
      fetchDimensionLabels={fetchDimensionLabels}
      fetchDimensionLabelsOfDataset={fetchDimensionLabelsOfDataset}
      fetchDimensionLabelsToDatasetsMapping={
        fetchDimensionLabelsToDatasetsMapping
      }
      fetchDatasetsMatchingContextIncludingEntities={
        fetchDatasetsMatchingContextIncludingEntities
      }
    >
      <DataExplorer2MainContent
        initialPlot={initialPlot}
        feedbackUrl={feedbackUrl}
        contactEmail={contactEmail}
        tutorialLink={tutorialLink}
      />
    </DataExplorerApiProvider>
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
