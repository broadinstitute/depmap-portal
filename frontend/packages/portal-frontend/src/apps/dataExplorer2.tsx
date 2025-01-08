import "src/public-path";
import React from "react";
import ReactDOM from "react-dom";
import { ApiContext } from "@depmap/api";
import {
  DataExplorerSettingsProvider,
  DeprecatedDataExplorerApiProvider,
} from "@depmap/data-explorer-2";
import { apiFunctions } from "src/common/utilities/context";
import ErrorBoundary from "src/common/components/ErrorBoundary";
import DataExplorer2 from "src/data-explorer-2/components/DataExplorer2";
import {
  evaluateLegacyContext,
  fetchAnalysisResult,
  fetchAssociations,
  fetchContextSummary,
  fetchCorrelation,
  fetchDatasetDetails,
  fetchDatasetsByIndexType,
  fetchDatasetsMatchingContextIncludingEntities,
  fetchDimensionLabels,
  fetchDimensionLabelsOfDataset,
  fetchDimensionLabelsToDatasetsMapping,
  fetchGeneTeaEnrichment,
  fetchGeneTeaTermContext,
  fetchLinearRegression,
  fetchMetadataColumn,
  fetchMetadataSlices,
  fetchPlotDimensions,
  fetchUniqueValuesOrRange,
  fetchWaterfall,
} from "src/data-explorer-2/deprecated-api";
import "react-bootstrap-typeahead/css/Typeahead.css";
import "src/common/styles/typeahead_fix.scss";

const container = document.getElementById("data-explorer-2");
const dataElement = document.getElementById("data-explorer-2-data");
if (!dataElement || !dataElement.textContent) {
  throw new Error(
    `Expected a DOM element like <script type="application/json">{ ... }</script>'`
  );
}

const { feedbackUrl, contactEmail, tutorialLink } = JSON.parse(
  dataElement.textContent
);

const App = () => {
  return (
    <ErrorBoundary>
      <ApiContext.Provider value={apiFunctions.depmap}>
        <DeprecatedDataExplorerApiProvider
          evaluateLegacyContext={evaluateLegacyContext}
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
          fetchAnalysisResult={fetchAnalysisResult}
          fetchAssociations={fetchAssociations}
          fetchContextSummary={fetchContextSummary}
          fetchMetadataColumn={fetchMetadataColumn}
          fetchCorrelation={fetchCorrelation}
          fetchGeneTeaEnrichment={fetchGeneTeaEnrichment}
          fetchGeneTeaTermContext={fetchGeneTeaTermContext}
          fetchLinearRegression={fetchLinearRegression}
          fetchMetadataSlices={fetchMetadataSlices}
          fetchPlotDimensions={fetchPlotDimensions}
          fetchUniqueValuesOrRange={fetchUniqueValuesOrRange}
          fetchWaterfall={fetchWaterfall}
        >
          <DataExplorerSettingsProvider>
            <DataExplorer2
              feedbackUrl={feedbackUrl}
              contactEmail={contactEmail}
              tutorialLink={tutorialLink}
            />
          </DataExplorerSettingsProvider>
        </DeprecatedDataExplorerApiProvider>
      </ApiContext.Provider>
    </ErrorBoundary>
  );
};

ReactDOM.render(<App />, container);
