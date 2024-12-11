import * as React from "react";
import { useContext } from "react";
import { renderCellLineSelectorModal } from "@depmap/cell-line-selector";
import { ApiContext } from "@depmap/api";
import { CustomAnalysesPage } from "@depmap/custom-analyses";
import { DataExplorerApiProvider } from "@depmap/data-explorer-2";
import {
  fetchDatasets,
  fetchDatasetsByIndexType,
  fetchDatasetIdentifiers,
  fetchDimensionIdentifiers,
  fetchDimensionTypes,
} from "src/pages/DataExplorer/api";

const cellLineSelectorContainer = document.getElementById(
  "cell_line_selector_modal"
);

export default function ElaraCustomAnalysesPage() {
  const apiContext = useContext(ApiContext);

  const launchCellLineSelectorModal = () =>
    renderCellLineSelectorModal(apiContext.getApi, cellLineSelectorContainer);

  const fetchSimplifiedCellLineData = () => {
    return fetchDimensionIdentifiers("depmap_model").then((identifiers) => {
      return new Map(
        identifiers.map(({ id, label }) => [id, { displayName: label }])
      );
    });
  };

  return (
    <DataExplorerApiProvider
      fetchDatasets={fetchDatasets}
      fetchDatasetsByIndexType={fetchDatasetsByIndexType}
      fetchDatasetIdentifiers={fetchDatasetIdentifiers}
      fetchDimensionIdentifiers={fetchDimensionIdentifiers}
      fetchDimensionTypes={fetchDimensionTypes}
    >
      <CustomAnalysesPage
        fetchSimplifiedCellLineData={fetchSimplifiedCellLineData}
        launchCellLineSelectorModal={launchCellLineSelectorModal}
      />
    </DataExplorerApiProvider>
  );
}
