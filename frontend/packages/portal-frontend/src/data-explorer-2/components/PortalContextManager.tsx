import React from "react";
import { ApiContext } from "@depmap/api";
import {
  ContextManager,
  DeprecatedDataExplorerApiProvider,
} from "@depmap/data-explorer-2";
import {
  evaluateLegacyContext,
  fetchContextSummary,
  fetchDatasetDetails,
  fetchDatasetsByIndexType,
  fetchDatasetsMatchingContextIncludingEntities,
  fetchDimensionLabels,
  fetchDimensionLabelsOfDataset,
  fetchDimensionLabelsToDatasetsMapping,
  fetchMetadataColumn,
  fetchMetadataSlices,
  fetchUniqueValuesOrRange,
} from "src/data-explorer-2/deprecated-api";
import { getDapi as getApi } from "src/common/utilities/context";

interface Props {
  onHide: () => void;
  showHelpText?: boolean;
  initialContextType?: string;
}

function PortalContextManager({
  onHide,
  showHelpText = false,
  initialContextType = undefined,
}: Props) {
  return (
    // ApiContext is needed to support Cell Line Selector inside of
    // ContextBuilder.
    <ApiContext.Provider value={{ getApi }}>
      <DeprecatedDataExplorerApiProvider
        evaluateLegacyContext={evaluateLegacyContext}
        fetchContextSummary={fetchContextSummary}
        fetchDatasetDetails={fetchDatasetDetails}
        fetchDatasetsByIndexType={fetchDatasetsByIndexType}
        fetchDimensionLabels={fetchDimensionLabels}
        fetchDimensionLabelsOfDataset={fetchDimensionLabelsOfDataset}
        fetchDimensionLabelsToDatasetsMapping={
          fetchDimensionLabelsToDatasetsMapping
        }
        fetchDatasetsMatchingContextIncludingEntities={
          fetchDatasetsMatchingContextIncludingEntities
        }
        fetchMetadataColumn={fetchMetadataColumn}
        fetchMetadataSlices={fetchMetadataSlices}
        fetchUniqueValuesOrRange={fetchUniqueValuesOrRange}
      >
        <ContextManager
          onHide={onHide}
          initialContextType={initialContextType}
          showHelpText={showHelpText}
        />
      </DeprecatedDataExplorerApiProvider>
    </ApiContext.Provider>
  );
}

export default PortalContextManager;
