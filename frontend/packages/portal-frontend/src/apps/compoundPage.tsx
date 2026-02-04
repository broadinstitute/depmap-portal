import "src/public-path";
import React from "react";
import ReactDOM from "react-dom";
import ErrorBoundary from "src/common/components/ErrorBoundary";
import CompoundPage from "src/compound/components/CompoundPage";

const container = document.getElementById("react-compound-page-root");
const dataElement = document.getElementById("react-compound-page-data");
if (!dataElement || !dataElement.textContent) {
  throw new Error(
    `Expected a DOM element like <script type="application/json">{ ... }</script>'`
  );
}

const data = JSON.parse(dataElement.textContent);

const {
  isMobile,
  order,
  compoundName,
  compoundId,
  aka, // Comma separated string of compound aliases
  compoundUnits,
  predictabilityCustomDownloadsLink,
  predictabilityMethodologyLink,
  hasDatasets,
  showPredictabilityTab,
} = data;

const App = () => {
  return (
    <ErrorBoundary>
      <CompoundPage
        isMobile={isMobile}
        order={order}
        compoundName={compoundName}
        compoundId={compoundId}
        aka={aka}
        compoundUnits={compoundUnits}
        predictabilityCustomDownloadsLink={predictabilityCustomDownloadsLink}
        predictabilityMethodologyLink={predictabilityMethodologyLink}
        hasDatasets={hasDatasets}
        showPredictabilityTab={showPredictabilityTab}
      />
    </ErrorBoundary>
  );
};

ReactDOM.render(<App />, container);
