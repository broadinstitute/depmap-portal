import React from "react";
import { PlotlyLoaderProvider } from "@depmap/data-explorer-2/src/contexts/PlotlyLoaderContext";
import useWaterfallPlotData from "@depmap/data-explorer-2/src/components/DataExplorerPage/components/plot/prototype/useWaterfallPlotData";
import {
  DataExplorerPlotConfig,
  DataExplorerPlotResponse,
} from "@depmap/types";
import PrototypeScatterPlot from "@depmap/data-explorer-2/src/components/DataExplorerPage/components/plot/prototype/PrototypeScatterPlot";
import { useDataExplorerSettings } from "@depmap/data-explorer-2/src/contexts/DataExplorerSettingsContext";
import ScatterLoader from "./loaders/ScatterLoader";

interface Props {
  data: DataExplorerPlotResponse | null;
  height: number;
  plotConfig: DataExplorerPlotConfig;
}

function DataExplorerWaterfallPlot({ data, height, plotConfig }: Props) {
  const { plotStyles } = useDataExplorerSettings();
  const { pointSize, pointOpacity, outlineWidth, palette } = plotStyles;

  const { formattedData, contLegendKeys, colorMap } = useWaterfallPlotData(
    data,
    plotConfig,
    palette
  );

  if (!formattedData) {
    return null;
  }

  return (
    <PlotlyLoaderProvider PlotlyLoader={ScatterLoader}>
      <PrototypeScatterPlot
        data={formattedData}
        xKey="x"
        yKey="y"
        colorKey1="color1"
        colorKey2="color2"
        categoricalColorKey="catColorData"
        continuousColorKey="contColorData"
        contLegendKeys={contLegendKeys}
        colorMap={colorMap}
        hoverTextKey="hoverText"
        annotationTextKey="annotationText"
        height={height}
        xLabel={formattedData?.xLabel || ""}
        yLabel={formattedData?.yLabel || ""}
        pointSize={pointSize}
        pointOpacity={pointOpacity}
        outlineWidth={outlineWidth}
        customHoverinfo="y+text"
        hideXAxisGrid
        hideXAxis={Boolean(data?.metadata?.color_property)}
        palette={palette}
        xAxisFontSize={13}
        yAxisFontSize={13}
      />
    </PlotlyLoaderProvider>
  );
}

export default DataExplorerWaterfallPlot;
