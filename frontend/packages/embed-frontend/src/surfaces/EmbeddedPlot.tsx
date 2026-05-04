import React, { useEffect, useState } from "react";
import { readPlotFromQueryString } from "@depmap/data-explorer-2/src/components/DataExplorerPage/utils";
import { isCompletePlot } from "@depmap/data-explorer-2/src/components/DataExplorerPage/validation";
import { DataExplorerPlotConfig } from "@depmap/types";
import ContainerSized from "../components/ContainerSized";
import Plot from "../components/Plot";

function EmbeddedPlot() {
  const [error, setError] = useState(false);
  const [plotConfig, setPlotConfig] = useState<DataExplorerPlotConfig | null>(
    null
  );

  useEffect(() => {
    (async () => {
      try {
        const plot = await readPlotFromQueryString();
        setPlotConfig(plot);
      } catch (e) {
        window.console.error(e);
        setError(true);
      }
    })();
  }, []);

  if (error || (plotConfig && !isCompletePlot(plotConfig))) {
    return (
      <div style={{ padding: 20 }}>
        Cannot render plot. There was a problem reading the query params.
      </div>
    );
  }

  return (
    <ContainerSized>
      {({ height }) => <Plot plotConfig={plotConfig} height={height} />}
    </ContainerSized>
  );
}

export default EmbeddedPlot;
