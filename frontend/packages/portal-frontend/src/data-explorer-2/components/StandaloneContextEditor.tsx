import React from "react";
import {
  ContextBuilderModal,
  ContextBuilderV2,
  isBreadboxOnlyMode,
  PlotlyLoaderProvider,
  saveContextToLocalStorageAndPersist,
} from "@depmap/data-explorer-2";
import { DataExplorerContext, DataExplorerContextV2 } from "@depmap/types";
import PlotlyLoader from "src/plot/components/PlotlyLoader";

const ContextBuilder = isBreadboxOnlyMode
  ? (ContextBuilderV2 as any)
  : ContextBuilderModal;

interface Props {
  /* The context to use as a starting point. This can be as simple as
   * { context_type: '...' } if that's all the information you know. */
  context:
    | { context_type: string }
    | { dimension_type: string }
    | DataExplorerContext
    | DataExplorerContextV2;

  /* Supply a hash if an existing context should be replaced by the edited one
   * or null if this should be considered a brand new context. */
  hash: string | null;

  // Call when saved and when dismissed.
  onHide: () => void;

  // Only called on save.
  onSave?: (context: DataExplorerContext, hash: string) => void;
}

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
    <PlotlyLoaderProvider PlotlyLoader={PlotlyLoader}>
      <ContextBuilder
        show
        context={context}
        isExistingContext={Boolean(hash)}
        onClickSave={onClickSave}
        onHide={onHide}
      />
    </PlotlyLoaderProvider>
  );
}

export default StandaloneContextEditor;
