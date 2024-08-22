import "src/public-path";
import React from "react";
import ReactDOM from "react-dom";
import ErrorBoundary from "src/common/components/ErrorBoundary";
import CellLinePage from "src/cellLine/components/CellLinePage";

const container = document.getElementById("react-cell-line-page-root");
const dataElement = document.getElementById("react-cell-line-page-data");
if (!dataElement || !dataElement.textContent) {
  throw new Error(
    `Expected a DOM element like <script type="application/json">{ ... }</script>'`
  );
}

const data = JSON.parse(dataElement.textContent);

const { strippedCellLineName, publicComments, modelId, hasMetMapData } = data;

const App = () => {
  return (
    <ErrorBoundary>
      <CellLinePage
        strippedCellLineName={strippedCellLineName}
        publicComments={publicComments}
        modelId={modelId}
        hasMetMapData={hasMetMapData}
      />
    </ErrorBoundary>
  );
};

ReactDOM.render(<App />, container);
