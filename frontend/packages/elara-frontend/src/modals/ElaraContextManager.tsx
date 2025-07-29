import React from "react";
import { ContextManager } from "@depmap/data-explorer-2";

interface Props {
  onHide: () => void;
  initialContextType?: string;
}

function ElaraContextManager({
  onHide,
  initialContextType = undefined,
}: Props) {
  return (
    <ContextManager
      onHide={onHide}
      initialContextType={initialContextType}
      showHelpText={false}
    />
  );
}

export default ElaraContextManager;
