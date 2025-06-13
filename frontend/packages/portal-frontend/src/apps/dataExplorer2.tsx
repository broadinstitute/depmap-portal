import "src/public-path";
import React from "react";
import ReactDOM from "react-dom";
import {
  DataExplorerPage,
  DataExplorerSettingsProvider,
  DeprecatedDataExplorerApiProvider,
  PlotlyLoaderProvider,
} from "@depmap/data-explorer-2";
import PlotlyLoader from "src/plot/components/PlotlyLoader";
import ErrorBoundary from "src/common/components/ErrorBoundary";
import {
  evaluateLegacyContext,
  fetchAnalysisResult,
  fetchLegacyAssociations,
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
      <PlotlyLoaderProvider PlotlyLoader={PlotlyLoader}>
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
          fetchLegacyAssociations={fetchLegacyAssociations}
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
            <DataExplorerPage
              feedbackUrl={feedbackUrl}
              contactEmail={contactEmail}
              tutorialLink={tutorialLink}
            />
          </DataExplorerSettingsProvider>
        </DeprecatedDataExplorerApiProvider>
      </PlotlyLoaderProvider>
    </ErrorBoundary>
  );
};

ReactDOM.render(<App />, container);
