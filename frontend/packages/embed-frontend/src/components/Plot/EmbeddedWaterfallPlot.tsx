import React from "react";
import { PlotlyLoaderProvider } from "@depmap/data-explorer-2/src/contexts/PlotlyLoaderContext";
import useWaterfallPlotData from "@depmap/data-explorer-2/src/components/DataExplorerPage/components/plot/prototype/useWaterfallPlotData";
import {
  DataExplorerPlotConfig,
  DataExplorerPlotResponse,
} from "@depmap/types";
import PrototypeScatterPlot from "@depmap/data-explorer-2/src/components/DataExplorerPage/components/plot/prototype/PrototypeScatterPlot";
import { useDataExplorerSettings } from "@depmap/data-explorer-2/src/contexts/DataExplorerSettingsContext";
import type { PlotSelection } from "./PlotSelection";
import ScatterLoader from "../../loaders/ScatterLoader";
import useBuiltinLegendClick from "./useBuiltinLegendClick";

interface Props {
  data: DataExplorerPlotResponse | null;
  height: number;
  plotConfig: DataExplorerPlotConfig;
  selection?: PlotSelection;
}

function DataExplorerWaterfallPlot({
  data,
  height,
  plotConfig,
  selection = undefined,
}: Props) {
  const { plotStyles } = useDataExplorerSettings();
  const {
    pointSize,
    facetedPointSize,
    pointOpacity,
    outlineWidth,
    palette,
    annotationFontSize,
    xAxisFontSize,
    yAxisFontSize,
  } = plotStyles;

  const {
    formattedData,
    contLegendKeys,
    colorMap,
    legendForDownload,
    builtinLegend,
    legendState,
    pointVisibility,
    hasFacetOptionsEnabled,
    selectionRegions,
  } = useWaterfallPlotData(data, plotConfig, palette);

  const onClickLegendItem = useBuiltinLegendClick(legendState, colorMap);

  if (!formattedData) {
    return null;
  }

  // Only worth revealing when something is actually colored — otherwise the
  // legend is one entry for the single ungrouped bucket. Same condition
  // EmbeddedScatterPlot uses.
  const showBuiltinLegend = Boolean(
    data?.metadata.color_property ||
      data?.dimensions.color ||
      data?.filters.color1 ||
      data?.filters.color2
  );

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
        pointVisibility={pointVisibility || undefined}
        legendForDownload={legendForDownload}
        builtinLegend={builtinLegend}
        onClickLegendItem={onClickLegendItem}
        showBuiltinLegend={showBuiltinLegend}
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
        annotationFontSize={annotationFontSize}
        xAxisFontSize={xAxisFontSize}
        yAxisFontSize={yAxisFontSize}
        // Selection, wired as in Data Explorer: the x-clusters are the regions
        // a drag may not cross, and under facet_by "expansion" a gesture stays
        // within one of them. Only when a selection is supplied.
        selectionAxis="x"
        selectionRegions={selection ? selectionRegions : undefined}
        enforceSingleFacetSelection={
          Boolean(selection) && plotConfig.facet_by === "expansion"
        }
        {...selection}
      />
    </PlotlyLoaderProvider>
  );
}

export default DataExplorerWaterfallPlot;
