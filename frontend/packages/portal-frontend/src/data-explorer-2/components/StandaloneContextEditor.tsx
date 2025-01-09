import React from "react";
import { ApiContext } from "@depmap/api";
import {
  ContextBuilderModal,
  DeprecatedDataExplorerApiProvider,
  saveContextToLocalStorageAndPersist,
} from "@depmap/data-explorer-2";
import { DataExplorerContext } from "@depmap/types";
import { getDapi as getApi } from "src/common/utilities/context";
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
  /* The context to use as a starting point. This can be as simple as
   * { context_type: '...' } if that's all the information you know. */
  context: { context_type: string } | DataExplorerContext;

  /* Supply a hash if an existing context should be replaced by the edited one
   * or null if this should be considered a brand new context. */
  hash: string | null;

  // Call when saved and when dismissed.
  onHide: () => void;

  // Only called on save.
  onSave?: (context: DataExplorerContext, hash: string) => void;
}

const getVectorCatalogApi = () => {
  throw new Error("Vector Catalog API is no longer supported!");
};

function StandaloneContextEditor({
  context,
  hash,
  onHide,
  onSave = () => {},
}: Props) {
  if (!context) {
    window.console.warn("StandaloneContextEditor launched without a context!");
    return null;
  }

  const onClickSave = async (editedContext: DataExplorerContext) => {
    const nextHash = await saveContextToLocalStorageAndPersist(
      editedContext,
      hash
    );
    onSave(editedContext, nextHash);
    onHide();

    if ("name" in context && context.name) {
      window.dispatchEvent(
        new CustomEvent("dx2_context_edited", {
          detail: {
            prevContext: context,
            nextContext: editedContext,
            prevHash: hash,
            nextHash,
          },
        })
      );
    }
  };

  return (
    <ApiContext.Provider value={{ getApi, getVectorCatalogApi }}>
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
        <ContextBuilderModal
          show
          context={context}
          isExistingContext={Boolean(hash)}
          onClickSave={onClickSave}
          onHide={onHide}
        />
      </DeprecatedDataExplorerApiProvider>
    </ApiContext.Provider>
  );
}

export default StandaloneContextEditor;
