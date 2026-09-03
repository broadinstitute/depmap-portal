import React from "react";
import { PlotlyLoaderProvider } from "@depmap/data-explorer-2/src/contexts/PlotlyLoaderContext";
import useWaterfallPlotData from "@depmap/data-explorer-2/src/components/DataExplorerPage/components/plot/prototype/useWaterfallPlotData";
import {
  DataExplorerPlotConfig,
  DataExplorerPlotResponse,
} from "@depmap/types";
import PrototypeScatterPlot from "@depmap/data-explorer-2/src/components/DataExplorerPage/components/plot/prototype/PrototypeScatterPlot";
import { useDataExplorerSettings } from "@depmap/data-explorer-2/src/contexts/DataExplorerSettingsContext";
import ScatterLoader from "../../loaders/ScatterLoader";

interface Props {
  data: DataExplorerPlotResponse | null;
  height: number;
  plotConfig: DataExplorerPlotConfig;
}

function DataExplorerWaterfallPlot({ data, height, plotConfig }: Props) {
  const { plotStyles } = useDataExplorerSettings();
  const {
    pointSize,
    facetedPointSize,
    pointOpacity,
    outlineWidth,
    palette,
  } = plotStyles;

  const {
    formattedData,
    contLegendKeys,
    colorMap,
    hasFacetOptionsEnabled,
  } = useWaterfallPlotData(data, plotConfig, palette);

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
        // The hook bakes facet_by's x-clustering into formattedData, so this
        // plot is genuinely faceted even though hasFacetOptionsEnabled isn't
        // threaded to PrototypeScatterPlot here (that prop only drives inert
        // color and drag-selection regions, neither of which embeds use).
        pointSize={hasFacetOptionsEnabled ? facetedPointSize : pointSize}
        pointOpacity={pointOpacity}
        outlineWidth={outlineWidth}
        customHoverinfo="y+text"
        hideXAxisGrid
        // facet_property too, matching DataExplorerWaterfallPlot: clustering
        // makes x a per-cluster rank, so the tick numbers are as meaningless
        // as they are under a color_property.
        hideXAxis={Boolean(
          data?.metadata?.color_property || data?.metadata?.facet_property
        )}
        palette={palette}
        xAxisFontSize={13}
        yAxisFontSize={13}
      />
    </PlotlyLoaderProvider>
  );
}

export default DataExplorerWaterfallPlot;
