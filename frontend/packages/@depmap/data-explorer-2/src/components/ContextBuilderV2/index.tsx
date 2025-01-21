import React from "react";
import { DataExplorerContext, DataExplorerContextV2 } from "@depmap/types";
import useModalContainer from "./hooks/useModalContainer";
import ContextBuilderModal from "./ContextBuilderModal";

interface Props {
  show: boolean;
  context:
    | { context_type: string }
    | { dimension_type: string }
    | DataExplorerContext
    | DataExplorerContextV2;
  onClickSave: (newContext: DataExplorerContextV2) => void;
  onHide: () => void;
  backdrop?: "static" | boolean;
  isExistingContext?: boolean;
}

function ContextBuilderV2({
  show,
  context,
  onClickSave,
  onHide,
  backdrop = "static",
  isExistingContext = false,
}: Props) {
  useModalContainer();

  if ("context_type" in context && "expr" in context) {
    throw new Error("Legacy contexts not yet supported");
  }

  const contextToEdit =
    "dimension_type" in context
      ? context
      : {
          dimension_type: context.context_type,
        };

  return (
    <ContextBuilderModal
      key={`${show}`}
      show={show}
      onClickSave={onClickSave}
      onHide={onHide}
      backdrop={backdrop}
      context={contextToEdit}
      isExistingContext={isExistingContext}
    />
  );
}

export default ContextBuilderV2;
