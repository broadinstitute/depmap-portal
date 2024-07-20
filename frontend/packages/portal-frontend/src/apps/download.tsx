import "src/public-path";
import React from "react";
import ReactDOM from "react-dom";
import { getQueryParams } from "@depmap/utils";
import ErrorBoundary from "src/common/components/ErrorBoundary";
import { AllDownloads } from "src/download/components/AllDownloads";

const container = document.getElementById("react-all-downloads-root");
if (!container) {
  throw new Error(`Expected a <div> with id "react-all-downloads-root"`);
}

const dataElement = document.getElementById("react-download-data");
if (!dataElement || !dataElement.textContent) {
  throw new Error(
    `Expected a DOM element like <script type="application/json">{ ... }</script>'`
  );
}
const data = JSON.parse(dataElement.textContent);

const { bulkDownloadCsvUrl, mode, termsDefinitions } = data;
const { release, file, modal } = getQueryParams(new Set(["releasename"]));

const App = () => {
  return (
    <ErrorBoundary>
      <AllDownloads
        releases={release as Set<string>}
        file={file as string}
        modal={Boolean(modal)}
        bulkDownloadCsvUrl={bulkDownloadCsvUrl}
        termsDefinitions={termsDefinitions}
        mode={mode}
        updateReactLoadStatus={() =>
          container.setAttribute(
            "data-react-component-loaded-for-selenium",
            "true"
          )
        }
      />
    </ErrorBoundary>
  );
};

ReactDOM.render(<App />, container);
