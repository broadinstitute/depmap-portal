import React from "react";
import { PlotlyLoaderProvider } from "@depmap/data-explorer-2/src/contexts/PlotlyLoaderContext";
import useDensity1DPlotData from "@depmap/data-explorer-2/src/components/DataExplorerPage/components/plot/prototype/useDensity1DPlotData";
import PrototypeDensity1D from "@depmap/data-explorer-2/src/components/DataExplorerPage/components/plot/prototype/PrototypeDensity1D";
import { useDataExplorerSettings } from "@depmap/data-explorer-2/src/contexts/DataExplorerSettingsContext";
import {
  DataExplorerPlotConfig,
  DataExplorerPlotResponse,
} from "@depmap/types";
import DensityLoader from "./loaders/DensityLoader";

interface Props {
  data: DataExplorerPlotResponse | null;
  height: number;
  plotConfig: DataExplorerPlotConfig;
}

function EmbeddedDensity1DPlot({ data, height, plotConfig }: Props) {
  const { plotStyles } = useDataExplorerSettings();
  const { pointSize, pointOpacity, outlineWidth, palette } = plotStyles;

  const {
    formattedData,
    colorData,
    legendState,
    colorMap,
    legendDisplayNames,
    legendTitle,
    pointVisibility,
  } = useDensity1DPlotData(data, plotConfig, palette);

  const { hiddenLegendValues } = legendState;

  if (!formattedData) {
    return null;
  }

  return (
    <PlotlyLoaderProvider PlotlyLoader={DensityLoader}>
      <PrototypeDensity1D
        data={formattedData}
        xKey="x"
        colorMap={colorMap}
        colorData={colorData}
        continuousColorKey="contColorData"
        legendDisplayNames={legendDisplayNames}
        legendTitle={legendTitle}
        pointVisibility={pointVisibility || undefined}
        useSemiOpaqueViolins={!plotConfig.hide_points}
        hoverTextKey="hoverText"
        annotationTextKey="annotationText"
        height={height}
        hiddenLegendValues={hiddenLegendValues}
        pointSize={pointSize}
        pointOpacity={pointOpacity}
        outlineWidth={outlineWidth}
        palette={palette}
        xAxisFontSize={13}
        yAxisFontSize={13}
      />
    </PlotlyLoaderProvider>
  );
}

export default EmbeddedDensity1DPlot;
