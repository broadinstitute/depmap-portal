import "src/public-path";
import * as React from "react";
import * as ReactDOM from "react-dom";
import ErrorBoundary from "src/common/components/ErrorBoundary";
import {
  DataExplorerApiProvider,
  fetchDatasetDetails,
  fetchDatasetsByIndexType,
  fetchDatasetsMatchingContextIncludingEntities,
  fetchDimensionLabels,
  fetchDimensionLabelsToDatasetsMapping,
} from "@depmap/data-explorer-2";
import { InteractivePage } from "@depmap/interactive";
import { getQueryParams } from "@depmap/utils";
import { renderCellLineSelectorModal } from "@depmap/cell-line-selector";
import {
  getVectorCatalogApi,
  getDapi,
  apiFunctions,
  fetchUrlPrefix,
} from "src/common/utilities/context";
import { ApiContext } from "@depmap/api";
import PlotlyLoader from "src/plot/components/PlotlyLoader";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Spinner } from "@depmap/common-components";
import { CustomAnalysesPage } from "@depmap/custom-analyses";

const container = document.getElementById("react-interactive-root");
const dataElement = document.getElementById("react-interactive-data");
if (!dataElement || !dataElement.textContent) {
  throw new Error(
    `Expected a DOM element like <script type="application/json">{ ... }</script>'`
  );
}

const cellLineSelectorContainer = document.getElementById(
  "cell_line_selector_modal"
); // defined in layout.html
const data = JSON.parse(dataElement.textContent);
const { showCustomAnalysis } = data;

const App = () => {
  const launchCellLineSelectorModal = () =>
    renderCellLineSelectorModal(
      getDapi,
      getVectorCatalogApi,
      cellLineSelectorContainer
    );

  const relativeUrlPrefix = fetchUrlPrefix();

  const customAnalysisPath = `${relativeUrlPrefix}/interactive/custom_analysis`;
  const interactivePath = `${relativeUrlPrefix}/interactive`;

  const fetchSimplifiedCellLineData = () => {
    return fetchDimensionLabels("depmap_model").then(({ labels, aliases }) => {
      return new Map(
        labels.map((depmapId, index) => [
          depmapId,
          { displayName: aliases[0].values[index] },
        ])
      );
    });
  };

  return (
    <ErrorBoundary>
      <ApiContext.Provider value={apiFunctions.depmap}>
        <DataExplorerApiProvider
          fetchDatasetDetails={fetchDatasetDetails}
          fetchDimensionLabels={fetchDimensionLabels}
          fetchDatasetsByIndexType={fetchDatasetsByIndexType}
          fetchDimensionLabelsToDatasetsMapping={
            fetchDimensionLabelsToDatasetsMapping
          }
          fetchDatasetsMatchingContextIncludingEntities={
            fetchDatasetsMatchingContextIncludingEntities
          }
        >
          <BrowserRouter basename="">
            <Routes>
              <Route
                path={customAnalysisPath}
                element={
                  <React.Suspense fallback={<Spinner />}>
                    <CustomAnalysesPage
                      fetchSimplifiedCellLineData={fetchSimplifiedCellLineData}
                      launchCellLineSelectorModal={launchCellLineSelectorModal}
                    />
                  </React.Suspense>
                }
              />
              <Route
                path={interactivePath}
                element={
                  <React.Suspense fallback={<Spinner />}>
                    <PlotlyLoader version="global">
                      {(Plotly) => (
                        <InteractivePage
                          Plotly={Plotly}
                          launchCellLineSelectorModal={
                            launchCellLineSelectorModal
                          }
                          query={getQueryParams() as { [key: string]: string }}
                          showCustomAnalysis={showCustomAnalysis}
                          updateReactLoadStatus={() =>
                            container!.setAttribute(
                              "data-react-component-loaded-for-selenium",
                              "true"
                            )
                          }
                        />
                      )}
                    </PlotlyLoader>
                  </React.Suspense>
                }
              />
            </Routes>
          </BrowserRouter>
        </DataExplorerApiProvider>
      </ApiContext.Provider>
    </ErrorBoundary>
  );
};

ReactDOM.render(<App />, container);

// test
