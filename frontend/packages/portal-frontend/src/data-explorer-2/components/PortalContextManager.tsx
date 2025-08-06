import React from "react";
import { ContextManager, PlotlyLoaderProvider } from "@depmap/data-explorer-2";
import PlotlyLoader from "src/plot/components/PlotlyLoader";

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
    <PlotlyLoaderProvider PlotlyLoader={PlotlyLoader}>
      <ContextManager
        onHide={onHide}
        initialContextType={initialContextType}
        showHelpText={showHelpText}
      />
    </PlotlyLoaderProvider>
  );
}

export default PortalContextManager;
