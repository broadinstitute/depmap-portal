import "src/public-path";
import * as React from "react";
import * as ReactDOM from "react-dom";
import ErrorBoundary from "src/common/components/ErrorBoundary";
import { DeprecatedDataExplorerApiProvider } from "@depmap/data-explorer-2";
import {
  evaluateLegacyContext,
  fetchDatasetDetails,
  fetchDatasetsByIndexType,
  fetchDatasetsMatchingContextIncludingEntities,
  fetchDimensionLabels,
  fetchDimensionLabelsToDatasetsMapping,
} from "src/data-explorer-2/deprecated-api";
import { CustomAnalysesPage } from "@depmap/custom-analyses";

const container = document.getElementById("react-interactive-root");

const App = () => {
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
      <DeprecatedDataExplorerApiProvider
        evaluateLegacyContext={evaluateLegacyContext}
        fetchDatasetDetails={fetchDatasetDetails}
        fetchDatasetsByIndexType={fetchDatasetsByIndexType}
        fetchDimensionLabels={fetchDimensionLabels}
        fetchDimensionLabelsToDatasetsMapping={
          fetchDimensionLabelsToDatasetsMapping
        }
        fetchDatasetsMatchingContextIncludingEntities={
          fetchDatasetsMatchingContextIncludingEntities
        }
      >
        <CustomAnalysesPage
          fetchSimplifiedCellLineData={fetchSimplifiedCellLineData}
        />
      </DeprecatedDataExplorerApiProvider>
    </ErrorBoundary>
  );
};

ReactDOM.render(<App />, container);
