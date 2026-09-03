import React from "react";
import { PlotlyLoaderProvider } from "@depmap/data-explorer-2/src/contexts/PlotlyLoaderContext";
import useDensity1DPlotData from "@depmap/data-explorer-2/src/components/DataExplorerPage/components/plot/prototype/useDensity1DPlotData";
import PrototypeDensity1D from "@depmap/data-explorer-2/src/components/DataExplorerPage/components/plot/prototype/PrototypeDensity1D";
import { useDataExplorerSettings } from "@depmap/data-explorer-2/src/contexts/DataExplorerSettingsContext";
import {
  DataExplorerPlotConfig,
  DataExplorerPlotResponse,
} from "@depmap/types";
import DensityLoader from "../../loaders/DensityLoader";

interface Props {
  data: DataExplorerPlotResponse | null;
  height: number;
  plotConfig: DataExplorerPlotConfig;
}

function EmbeddedDensity1DPlot({ data, height, plotConfig }: Props) {
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
    colorData,
    facetData,
    sortedFacetKeys,
    hasFacetOptionsEnabled,
    colorMatchesFacet,
    legendState,
    facetLegendState,
    colorMap,
    legendDisplayNames,
    facetDisplayNames,
    legendTitle,
    pointVisibility,
  } = useDensity1DPlotData(data, plotConfig, palette);

  const { hiddenLegendValues } = legendState;
  // Seeded by useLegendState with facet's own no-data keys, so facets with
  // nothing to plot start hidden. There's no Facets panel out here to toggle
  // them back on, but that seeding is the whole reason to pass this: without
  // it an empty facet renders as a blank track.
  const { hiddenLegendValues: hiddenFacetValues } = facetLegendState;

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
    <PlotlyLoaderProvider PlotlyLoader={DensityLoader}>
      <PrototypeDensity1D
        data={formattedData}
        xKey="x"
        colorMap={colorMap}
        colorData={colorData}
        facetData={facetData}
        groupKeys={sortedFacetKeys}
        colorMatchesFacet={colorMatchesFacet}
        continuousColorKey="contColorData"
        legendDisplayNames={legendDisplayNames}
        facetDisplayNames={facetDisplayNames}
        legendTitle={legendTitle}
        showBuiltinLegend={showBuiltinLegend}
        pointVisibility={pointVisibility || undefined}
        useSemiOpaqueViolins={!plotConfig.hide_points}
        placeholderEmptyTracks={Boolean(plotConfig.expand_by?.length)}
        hoverTextKey="hoverText"
        annotationTextKey="annotationText"
        height={height}
        hiddenLegendValues={hiddenLegendValues}
        hiddenFacetValues={hiddenFacetValues}
        pointSize={hasFacetOptionsEnabled ? facetedPointSize : pointSize}
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
