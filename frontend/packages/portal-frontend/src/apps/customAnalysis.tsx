import "src/public-path";
import * as React from "react";
import * as ReactDOM from "react-dom";
import { breadboxAPI, cached } from "@depmap/api";
import {
  deprecatedDataExplorerAPI,
  isBreadboxOnlyMode,
} from "@depmap/data-explorer-2";
import ErrorBoundary from "src/common/components/ErrorBoundary";
import { CustomAnalysesPage } from "@depmap/custom-analyses";

const container = document.getElementById("react-interactive-root");

const App = () => {
  const fetchSimplifiedCellLineData = () => {
    if (isBreadboxOnlyMode) {
      return cached(breadboxAPI)
        .getDimensionTypeIdentifiers("depmap_model")
        .then((identifiers) => {
          return new Map(
            identifiers.map(({ id, label }) => [id, { displayName: label }])
          );
        });
    }

    return deprecatedDataExplorerAPI
      .fetchDimensionLabels("depmap_model")
      .then(({ labels, aliases }) => {
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
      <CustomAnalysesPage
        fetchSimplifiedCellLineData={fetchSimplifiedCellLineData}
      />
    </ErrorBoundary>
  );
};

ReactDOM.render(<App />, container);
