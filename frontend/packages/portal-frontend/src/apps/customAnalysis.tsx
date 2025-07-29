import "src/public-path";
import * as React from "react";
import * as ReactDOM from "react-dom";
import { deprecatedDataExplorerAPI } from "@depmap/data-explorer-2";
import ErrorBoundary from "src/common/components/ErrorBoundary";
import { CustomAnalysesPage } from "@depmap/custom-analyses";

const container = document.getElementById("react-interactive-root");

const App = () => {
  const fetchSimplifiedCellLineData = () => {
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
