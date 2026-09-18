import React, { useEffect, useMemo, useState } from "react";
import { Base64 } from "js-base64";
import {
  DataExplorerSettingsContext,
  DEFAULT_SETTINGS,
} from "@depmap/data-explorer-2/src/contexts/DataExplorerSettingsContext";
import { readPlotFromQueryString } from "@depmap/data-explorer-2/src/components/DataExplorerPage/utils";
import { isCompletePlot } from "@depmap/data-explorer-2/src/components/DataExplorerPage/validation";
import { DataExplorerPlotConfig } from "@depmap/types";
import ContainerSized from "../components/ContainerSized";
import Plot from "../components/Plot";

const EMBEDDED_PLOT_STYLES = {
  ...DEFAULT_SETTINGS.plotStyles,
  // Unless otherwise specified, shrink the font size a little for
  // embedded plots.
  xAxisFontSize: 12,
  yAxisFontSize: 12,
};

export function readPlotStylesFromQueryString() {
  const encoded = new URLSearchParams(window.location.search).get("styles");

  if (!encoded) {
    return EMBEDDED_PLOT_STYLES;
  }

  try {
    const parsed = JSON.parse(Base64.decode(encoded));

    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error(`Expected an object but found ${JSON.stringify(parsed)}`);
    }

    return parsed;
  } catch (e) {
    window.console.error("Could not read the `styles` query param:", e);
    return EMBEDDED_PLOT_STYLES;
  }
}

function EmbeddedPlot() {
  const [error, setError] = useState(false);
  const [plotConfig, setPlotConfig] = useState<DataExplorerPlotConfig | null>(
    null
  );
  const plotStyles = useMemo(() => readPlotStylesFromQueryString(), []);

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
    <DataExplorerSettingsContext.Provider
      value={{ settings: { plotStyles }, launchSettingsModal: () => {} }}
    >
      <ContainerSized>
        {({ height }) => <Plot plotConfig={plotConfig} height={height} />}
      </ContainerSized>
    </DataExplorerSettingsContext.Provider>
  );
}

export default EmbeddedPlot;
