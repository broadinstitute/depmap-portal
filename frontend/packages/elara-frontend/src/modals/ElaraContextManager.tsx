import React from "react";
import { ContextManager, PlotlyLoaderProvider } from "@depmap/data-explorer-2";
import PlotlyLoader from "src/plot/components/PlotlyLoader";

interface Props {
  onHide: () => void;
  initialContextType?: string;
}

function ElaraContextManager({
  onHide,
  initialContextType = undefined,
}: Props) {
  return (
    <PlotlyLoaderProvider PlotlyLoader={PlotlyLoader}>
      <ContextManager
        onHide={onHide}
        initialContextType={initialContextType}
        showHelpText={false}
      />
    </PlotlyLoaderProvider>
  );
}

export default ElaraContextManager;
