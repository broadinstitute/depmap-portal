import React, { useState } from "react";
import { ApiContext } from "@depmap/api";
import {
  DataExplorerPage,
  DataExplorerSettingsProvider,
  DataExplorerApiProvider,
  DeprecatedDataExplorerApiProvider,
  PlotlyLoaderProvider,
} from "@depmap/data-explorer-2";
import { ElaraApi } from "src/api";
import PlotlyLoader from "src/plot/components/PlotlyLoader";
import {
  evaluateContext,
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
  let basename = "";
  //  hack for setting urlPrefix when Elara is served behind Depmap portal proxy
  if (window.location.pathname.includes("/breadbox/elara")) {
    basename = window.location.pathname.replace(/\/elara\/.*$/, "");
  }
  const [bbapi] = useState(
    () => new ElaraApi(basename === "" ? "/" : basename)
  );

  const getApi = () => bbapi;

  return (
    <PlotlyLoaderProvider PlotlyLoader={PlotlyLoader}>
      <ApiContext.Provider value={{ getApi }}>
        <DataExplorerApiProvider
          evaluateContext={evaluateContext}
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
      </ApiContext.Provider>
    </PlotlyLoaderProvider>
  );
}
