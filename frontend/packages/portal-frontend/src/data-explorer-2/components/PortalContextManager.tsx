import React from "react";
import { ContextManager } from "@depmap/data-explorer-2";

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
    <ContextManager
      onHide={onHide}
      initialContextType={initialContextType}
      showHelpText={showHelpText}
    />
  );
}

export default PortalContextManager;
