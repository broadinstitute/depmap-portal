import * as React from "react";
import { CustomAnalysesPage } from "@depmap/custom-analyses";
import { DataExplorerApiProvider } from "@depmap/data-explorer-2";
import {
  fetchDatasets,
  fetchDatasetIdentifiers,
  fetchDimensionIdentifiers,
  fetchDimensionTypes,
} from "src/pages/DataExplorer/api";

export default function ElaraCustomAnalysesPage() {
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
      fetchDatasetIdentifiers={fetchDatasetIdentifiers}
      fetchDimensionIdentifiers={fetchDimensionIdentifiers}
      fetchDimensionTypes={fetchDimensionTypes}
    >
      <CustomAnalysesPage
        fetchSimplifiedCellLineData={fetchSimplifiedCellLineData}
      />
    </DataExplorerApiProvider>
  );
}
