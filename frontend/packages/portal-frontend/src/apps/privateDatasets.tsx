import "src/public-path";
import React from "react";
import ReactDOM from "react-dom";
import ErrorBoundary from "src/common/components/ErrorBoundary";
import PrivateDatasetsPage from "src/privateDataset/components/PrivateDatasetsPage";

const container = document.getElementById("private-datasets-page-container");
const dataElement = document.getElementById("react-private-datasets-data");
if (!dataElement || !dataElement.textContent) {
  throw new Error(
    `Expected a DOM element like <script type="application/json">{ ... }</script>'`
  );
}

const data = JSON.parse(dataElement.textContent);
const { datasets, groups, dataTypes, email } = data;

const App = () => {
  return (
    <ErrorBoundary>
      <PrivateDatasetsPage
        datasets={datasets}
        groups={groups}
        dataTypes={dataTypes}
        email={email}
      />
    </ErrorBoundary>
  );
};

ReactDOM.render(<App />, container);
