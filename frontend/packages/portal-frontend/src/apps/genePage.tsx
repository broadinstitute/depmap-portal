import "src/public-path";
import React from "react";
import ReactDOM from "react-dom";
import ErrorBoundary from "src/common/components/ErrorBoundary";
import GenePage from "src/genePage/components/GenePage";

const container = document.getElementById("react-gene-page-root");
const dataElement = document.getElementById("react-gene-page-data");
if (!dataElement || !dataElement.textContent) {
  throw new Error(
    `Expected a DOM element like <script type="application/json">{ ... }</script>'`
  );
}

const data = JSON.parse(dataElement.textContent);

const {
  fullName,
  symbol,
  ensemblId,
  entrezId,
  hgncId,
  aka,
  showDependencyTab,
  showConfidenceTab,
  showCharacterizationTab,
  showPredictabilityTab,
  hasDatasets,
  order,
  isMobile,
  entityId,
  customDownloadsLink,
  methodologyLink,
  sizeBiomEnumName,
  color,
  figure,
  showAUCMessage,
  summaryOptions,
  showMutationsTile,
  showOmicsExpressionTile,
  showTargetingCompoundsTile,
} = data;

const App = () => {
  return (
    <ErrorBoundary>
      <GenePage
        fullName={fullName}
        symbol={symbol}
        ensemblId={ensemblId}
        entrezId={entrezId}
        hgncId={hgncId}
        aka={aka}
        showDependencyTab={showDependencyTab}
        showConfidenceTab={showConfidenceTab}
        showCharacterizationTab={showCharacterizationTab}
        showPredictabilityTab={showPredictabilityTab}
        hasDatasets={hasDatasets}
        order={order}
        isMobile={isMobile}
        entityId={entityId}
        customDownloadsLink={customDownloadsLink}
        methodologyLink={methodologyLink}
        sizeBiomEnumName={sizeBiomEnumName}
        color={color}
        figure={figure}
        showAUCMessage={showAUCMessage}
        summaryOptions={summaryOptions}
        showMutationsTile={showMutationsTile}
        showOmicsExpressionTile={showOmicsExpressionTile}
        showTargetingCompoundsTile={showTargetingCompoundsTile}
      />
    </ErrorBoundary>
  );
};

ReactDOM.render(<App />, container);
