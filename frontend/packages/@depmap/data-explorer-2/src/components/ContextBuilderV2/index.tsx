import React, { useEffect, useState } from "react";
import { DataExplorerContext, DataExplorerContextV2 } from "@depmap/types";
import { convertContextV1toV2 } from "../../utils/context-converter";
import useModalContainer from "./hooks/useModalContainer";
import LoadingModal from "./LoadingModal";
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
  startInTableView?: boolean;
}

function ContextBuilderV2({
  show,
  context,
  onClickSave,
  onHide,
  backdrop = "static",
  isExistingContext = false,
  startInTableView = false,
}: Props) {
  useModalContainer();

  const [contextToEdit, setContextToEdit] = useState<
    DataExplorerContextV2 | { dimension_type: string } | null
  >(null);

  const [isConverting, setIsConverting] = useState(false);

  useEffect(() => {
    if (!show) {
      setContextToEdit(null);
    }

    if (show && context) {
      if ("dimension_type" in context) {
        setContextToEdit(context);
      } else if ("context_type" in context && !("expr" in context)) {
        setContextToEdit({ dimension_type: context.context_type });
      } else {
        (async () => {
          setIsConverting(true);
          const convertedContext = await convertContextV1toV2(context);
          setIsConverting(false);

          setContextToEdit(convertedContext);
        })();
      }
    }
  }, [show, context]);

  if (isConverting) {
    return (
      <LoadingModal
        onHide={onHide}
        backdrop={backdrop}
        context={context}
        isExistingContext={isExistingContext}
      />
    );
  }

  if (!contextToEdit) {
    return null;
  }

  return (
    <ContextBuilderModal
      onClickSave={onClickSave}
      onHide={onHide}
      backdrop={backdrop}
      context={contextToEdit}
      isExistingContext={isExistingContext}
      startInTableView={startInTableView}
    />
  );
}

export default ContextBuilderV2;
