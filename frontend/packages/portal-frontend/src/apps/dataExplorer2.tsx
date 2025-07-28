import "src/public-path";
import React from "react";
import ReactDOM from "react-dom";
import {
  DataExplorerPage,
  DataExplorerSettingsProvider,
  PlotlyLoaderProvider,
} from "@depmap/data-explorer-2";
import PlotlyLoader from "src/plot/components/PlotlyLoader";
import ErrorBoundary from "src/common/components/ErrorBoundary";

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
        <DataExplorerSettingsProvider>
          <DataExplorerPage
            feedbackUrl={feedbackUrl}
            contactEmail={contactEmail}
            tutorialLink={tutorialLink}
          />
        </DataExplorerSettingsProvider>
      </PlotlyLoaderProvider>
    </ErrorBoundary>
  );
};

ReactDOM.render(<App />, container);
