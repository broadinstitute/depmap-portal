import "src/public-path";
import React from "react";
import ReactDOM from "react-dom";
import { ApiContext } from "@depmap/api";
import { DataExplorerSettingsProvider } from "@depmap/data-explorer-2";
import { apiFunctions } from "src/common/utilities/context";
import ErrorBoundary from "src/common/components/ErrorBoundary";
import DataExplorer2 from "src/data-explorer-2/components/DataExplorer2";
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
        <DataExplorerSettingsProvider>
          <DataExplorer2
            feedbackUrl={feedbackUrl}
            contactEmail={contactEmail}
            tutorialLink={tutorialLink}
          />
        </DataExplorerSettingsProvider>
      </ApiContext.Provider>
    </ErrorBoundary>
  );
};

ReactDOM.render(<App />, container);
