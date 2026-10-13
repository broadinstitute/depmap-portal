import React, { useEffect, useMemo, useState } from "react";
import { Base64 } from "js-base64";
import {
  DataExplorerSettingsContext,
  DEFAULT_SETTINGS,
} from "@depmap/data-explorer-2/src/contexts/DataExplorerSettingsContext";
import { breadboxAPI } from "@depmap/api";
import { decodePlotFromQueryString } from "@depmap/data-explorer-2/src/components/DataExplorerPage/utils";
import { DataExplorerPlotConfig } from "@depmap/types";
import ContainerSized from "../components/ContainerSized";
import LoadingSpinner from "../components/LoadingSpinner";
import { PlotView } from "../components/Plot";

type PlotData = Awaited<ReturnType<typeof breadboxAPI.getPlotData>>["data"];

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
  const [error, setError] = useState<string | null>(null);
  const [plotConfig, setPlotConfig] = useState<DataExplorerPlotConfig | null>(
    null
  );
  const [data, setData] = useState<PlotData | null>(null);
  const plotStyles = useMemo(() => readPlotStylesFromQueryString(), []);

  useEffect(() => {
    (async () => {
      try {
        // Reads `p=` (and the other URL formats) but doesn't migrate the plot.
        // The server does that and hands back the plot it actually used.
        const raw = await decodePlotFromQueryString();

        if (!raw) {
          throw new Error("There is no plot in the URL.");
        }

        const response = await breadboxAPI.getPlotData(raw);
        setPlotConfig(response.data.plot_config);
        setData(response.data);
      } catch (e) {
        window.console.error(e);
        setError(e instanceof Error ? e.message : String(e));
      }
    })();
  }, []);

  if (error) {
    return <div style={{ padding: 20 }}>Cannot render plot. {error}</div>;
  }

  return (
    <DataExplorerSettingsContext.Provider
      value={{ settings: { plotStyles }, launchSettingsModal: () => {} }}
    >
      <ContainerSized>
        {({ height }) =>
          plotConfig && data ? (
            <PlotView
              plotConfig={plotConfig}
              data={data}
              linreg_by_group={data.linreg_by_group}
              height={height}
            />
          ) : (
            <LoadingSpinner />
          )
        }
      </ContainerSized>
    </DataExplorerSettingsContext.Provider>
  );
}

export default EmbeddedPlot;
