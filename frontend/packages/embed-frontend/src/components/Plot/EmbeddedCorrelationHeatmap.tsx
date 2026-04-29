import React from "react";
import { PlotlyLoaderProvider } from "@depmap/data-explorer-2/src/contexts/PlotlyLoaderContext";
import {
  getDimensionTypeLabel,
  pluralize,
} from "@depmap/data-explorer-2/src/utils/misc";
import useCorrelationHeatmapData from "@depmap/data-explorer-2/src/components/DataExplorerPage/components/plot/prototype/useCorrelationHeatmapData";
import PrototypeCorrelationHeatmap from "@depmap/data-explorer-2/src/components/DataExplorerPage/components/plot/prototype/PrototypeCorrelationHeatmap";
import { useDataExplorerSettings } from "@depmap/data-explorer-2/src/contexts/DataExplorerSettingsContext";
import {
  DataExplorerPlotConfig,
  DataExplorerPlotResponse,
} from "@depmap/types";
import HeatmapLoader from "./loaders/HeatmapLoader";

interface Props {
  data: DataExplorerPlotResponse | null;
  height: number;
  plotConfig: DataExplorerPlotConfig;
}

function TooManyEntitiesWarning({
  data,
  onClickShowDensityFallback,
}: {
  data: DataExplorerPlotResponse | null;
  onClickShowDensityFallback: () => void;
}) {
  if (!data) {
    return null;
  }

  const dimension = data.dimensions.x as
    | {
        slice_type: string;
        context_size?: number; // HACK: Undocumented property
      }
    | undefined;

  if (!dimension) {
    return null;
  }

  const entitiesLabel = pluralize(getDimensionTypeLabel(dimension.slice_type));

  return (
    <div style={{ maxWidth: 600, padding: 20 }}>
      <p style={{ fontSize: 20 }}>
        ⚠️ Sorry, the selected context consists of{" "}
        {dimension.context_size?.toLocaleString()} {entitiesLabel}. The
        correlation heatmap can show at most 100.
      </p>
      <p>
        <button type="button" onClick={onClickShowDensityFallback}>
          OK, show me a Density plot instead
        </button>
      </p>
    </div>
  );
}

function DataExplorerCorrelationHeatmap({ data, height, plotConfig }: Props) {
  const { plotStyles } = useDataExplorerSettings();
  const { palette, xAxisFontSize } = plotStyles;

  const {
    heatmapData,
    xLabels,
    yLabels,
    showWarning,
  } = useCorrelationHeatmapData(data);

  if (showWarning) {
    return (
      <TooManyEntitiesWarning
        data={data}
        // FIXME
        onClickShowDensityFallback={() => {}}
      />
    );
  }

  if (!heatmapData) {
    return null;
  }

  return (
    <PlotlyLoaderProvider PlotlyLoader={HeatmapLoader}>
      <PrototypeCorrelationHeatmap
        data={heatmapData}
        xLabels={xLabels!}
        yLabels={yLabels!}
        xKey="x"
        yKey="y"
        zKey="z"
        z2Key={heatmapData.z2 ? "z2" : undefined}
        zLabel={heatmapData.zLabel}
        z2Label={heatmapData.z2Label}
        height={height}
        palette={palette}
        xAxisFontSize={xAxisFontSize}
        distinguish1Label={plotConfig.filters?.distinguish1?.name}
        distinguish2Label={plotConfig.filters?.distinguish2?.name}
      />
    </PlotlyLoaderProvider>
  );
}

export default DataExplorerCorrelationHeatmap;
