import React from "react";
import {
  ContextManager,
  DataExplorerApiProvider,
} from "@depmap/data-explorer-2";
import {
  evaluateContext,
  fetchDatasets,
  fetchDatasetIdentifiers,
  fetchDimensionIdentifiers,
  fetchDimensionTypes,
  fetchVariableDomain,
} from "src/pages/DataExplorer/api";

interface Props {
  onHide: () => void;
  initialContextType?: string;
}

function ElaraContextManager({
  onHide,
  initialContextType = undefined,
}: Props) {
  return (
    <DataExplorerApiProvider
      evaluateContext={evaluateContext}
      fetchVariableDomain={fetchVariableDomain}
      fetchDatasets={fetchDatasets}
      fetchDimensionTypes={fetchDimensionTypes}
      fetchDatasetIdentifiers={fetchDatasetIdentifiers}
      fetchDimensionIdentifiers={fetchDimensionIdentifiers}
    >
      <ContextManager
        onHide={onHide}
        initialContextType={initialContextType}
        useContextBuilderV2
        showHelpText={false}
      />
    </DataExplorerApiProvider>
  );
}

export default ElaraContextManager;
