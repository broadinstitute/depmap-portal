import React from "react";
import {
  ContextBuilderV2,
  DataExplorerApiProvider,
  saveContextToLocalStorageAndPersist,
} from "@depmap/data-explorer-2";
import { DataExplorerContextV2 } from "@depmap/types";
import {
  evaluateContext,
  fetchDatasets,
  fetchDatasetIdentifiers,
  fetchDimensionIdentifiers,
  fetchDimensionTypes,
  fetchVariableDomain,
} from "src/pages/DataExplorer/api";

interface Props {
  /* The context to use as a starting point. This can be as simple as
   * { dimension_type: '...' } if that's all the information you know. */
  context: { dimension_type: string } | DataExplorerContextV2;

  /* Supply a hash if an existing context should be replaced by the edited one
   * or null if this should be considered a brand new context. */
  hash: string | null;

  // Call when saved and when dismissed.
  onHide: () => void;

  // Only called on save.
  onSave?: ((context: DataExplorerContextV2, hash: string) => void) | null;
}

function ElaraStandaloneContextBuilder({
  context,
  hash,
  onHide,
  onSave = () => {},
}: Props) {
  if (!context) {
    window.console.warn(
      "ElaraStandaloneContextBuilder launched without a context!"
    );
    return null;
  }

  const onClickSave = async (editedContext: DataExplorerContextV2) => {
    const nextHash = await saveContextToLocalStorageAndPersist(
      editedContext,
      hash
    );
    onSave?.(editedContext, nextHash);
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
    <DataExplorerApiProvider
      evaluateContext={evaluateContext}
      fetchVariableDomain={fetchVariableDomain}
      fetchDatasets={fetchDatasets}
      fetchDimensionTypes={fetchDimensionTypes}
      fetchDatasetIdentifiers={fetchDatasetIdentifiers}
      fetchDimensionIdentifiers={fetchDimensionIdentifiers}
    >
      <ContextBuilderV2
        show
        context={context}
        isExistingContext={Boolean(hash)}
        onClickSave={onClickSave}
        onHide={onHide}
      />
    </DataExplorerApiProvider>
  );
}

export default ElaraStandaloneContextBuilder;
