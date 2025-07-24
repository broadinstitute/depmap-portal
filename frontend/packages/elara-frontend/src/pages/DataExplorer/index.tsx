import React from "react";
import {
  DataExplorerPage,
  DataExplorerSettingsProvider,
  DataExplorerApiProvider,
  DeprecatedDataExplorerApiProvider,
  PlotlyLoaderProvider,
} from "@depmap/data-explorer-2";
import PlotlyLoader from "src/plot/components/PlotlyLoader";
import {
  evaluateContext,
  fetchAssociations,
  fetchDatasetIdentifiers,
  fetchDatasets,
  fetchDimensionIdentifiers,
  fetchDimensionTypes,
  fetchVariableDomain,
} from "src/pages/DataExplorer/api";
import {
  fetchCorrelation,
  fetchDatasetsByIndexType,
  fetchLinearRegression,
  fetchMetadataSlices,
  fetchWaterfall,
} from "src/pages/DataExplorer/deprecated-api";
import fetchPlotDimensions from "src/pages/DataExplorer/fetchPlotDimensions";

export default function DataExplorer() {
  return (
    <PlotlyLoaderProvider PlotlyLoader={PlotlyLoader}>
      <DataExplorerApiProvider
        evaluateContext={evaluateContext}
        fetchAssociations={fetchAssociations}
        fetchDatasetIdentifiers={fetchDatasetIdentifiers}
        fetchDatasets={fetchDatasets}
        fetchDimensionIdentifiers={fetchDimensionIdentifiers}
        fetchDimensionTypes={fetchDimensionTypes}
        fetchVariableDomain={fetchVariableDomain}
      >
        <DeprecatedDataExplorerApiProvider
          fetchCorrelation={fetchCorrelation}
          fetchDatasetsByIndexType={fetchDatasetsByIndexType}
          fetchLinearRegression={fetchLinearRegression}
          fetchMetadataSlices={fetchMetadataSlices}
          fetchPlotDimensions={fetchPlotDimensions}
          fetchWaterfall={fetchWaterfall}
        >
          <DataExplorerSettingsProvider>
            <DataExplorerPage
              // FIXME: Read this from the build environment
              feedbackUrl="https://form.asana.com/?k=V7otztH5fkOhtBqkchS48w&d=9513920295503"
              contactEmail="depmap@broadinstitute.org"
              tutorialLink="https://sites.google.com/broadinstitute.org/depmap-de2-tutorial/home"
            />
          </DataExplorerSettingsProvider>
        </DeprecatedDataExplorerApiProvider>
      </DataExplorerApiProvider>
    </PlotlyLoaderProvider>
  );
}
