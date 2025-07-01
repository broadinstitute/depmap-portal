import React from "react";
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
  );
}

export default PortalContextManager;
