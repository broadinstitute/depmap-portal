import "src/public-path";
import React from "react";
import ReactDOM from "react-dom";
import { DeprecatedDataExplorerApiProvider } from "@depmap/data-explorer-2";
import { evaluateLegacyContext } from "src/data-explorer-2/deprecated-api";
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
  showCelfieTab,
  showCelfieTile,
  hasDatasets,
  order,
  isMobile,
  entityId,
  customDownloadsLink,
  methodologyLink,
  similarityOptions,
  colorOptions,
  connectivityOptions,
  targetFeatureLabel,
  datasets,
  dependencyProfileOptions,
  howToImg,
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
      <DeprecatedDataExplorerApiProvider
        evaluateLegacyContext={evaluateLegacyContext}
      >
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
          showCelfieTab={showCelfieTab}
          showCelfieTile={showCelfieTile}
          hasDatasets={hasDatasets}
          order={order}
          isMobile={isMobile}
          entityId={entityId}
          customDownloadsLink={customDownloadsLink}
          methodologyLink={methodologyLink}
          similarityOptions={similarityOptions}
          colorOptions={colorOptions}
          connectivityOptions={connectivityOptions}
          targetFeatureLabel={targetFeatureLabel}
          datasets={datasets}
          dependencyProfileOptions={dependencyProfileOptions}
          howToImg={howToImg}
          sizeBiomEnumName={sizeBiomEnumName}
          color={color}
          figure={figure}
          showAUCMessage={showAUCMessage}
          summaryOptions={summaryOptions}
          showMutationsTile={showMutationsTile}
          showOmicsExpressionTile={showOmicsExpressionTile}
          showTargetingCompoundsTile={showTargetingCompoundsTile}
        />
      </DeprecatedDataExplorerApiProvider>
    </ErrorBoundary>
  );
};

ReactDOM.render(<App />, container);
