import "src/public-path";
import React from "react";
import ReactDOM from "react-dom";
import ErrorBoundary from "src/common/components/ErrorBoundary";
import { InteractivePage } from "@depmap/interactive";
import { getQueryParams } from "@depmap/utils";
import { renderCellLineSelectorModalUsingBBApi } from "@depmap/cell-line-selector";
import {
  getBreadboxApi,
  apiFunctions,
  bbGetVectorCatalogApi,
} from "src/common/utilities/context";
import PlotlyLoader from "src/plot/components/PlotlyLoader";
import { ApiContext } from "@depmap/api";

const container = document.getElementById("react-interactive-v2-root");
const dataElement = document.getElementById("react-interactive-v2-data");
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
    renderCellLineSelectorModalUsingBBApi(
      getBreadboxApi,
      bbGetVectorCatalogApi,
      cellLineSelectorContainer
    );

  return (
    <ErrorBoundary>
      <ApiContext.Provider value={apiFunctions.breadbox}>
        <PlotlyLoader version="global">
          {(Plotly) => (
            <InteractivePage
              Plotly={Plotly}
              launchCellLineSelectorModal={launchCellLineSelectorModal}
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
      </ApiContext.Provider>
    </ErrorBoundary>
  );
};

ReactDOM.render(<App />, container);
