import React from "react";
import { PlotlyLoaderProvider } from "@depmap/data-explorer-2/src/contexts/PlotlyLoaderContext";
import useScatterPlotData from "@depmap/data-explorer-2/src/components/DataExplorerPage/components/plot/prototype/useScatterPlotData";
import PrototypeScatterPlot from "@depmap/data-explorer-2/src/components/DataExplorerPage/components/plot/prototype/PrototypeScatterPlot";
import { useDataExplorerSettings } from "@depmap/data-explorer-2/src/contexts/DataExplorerSettingsContext";
import {
  DataExplorerPlotConfig,
  DataExplorerPlotResponse,
  LinRegInfo,
} from "@depmap/types";
import ScatterLoader from "./loaders/ScatterLoader";

interface Props {
  data: DataExplorerPlotResponse | null;
  height: number;
  linreg_by_group: LinRegInfo[] | null;
  plotConfig: DataExplorerPlotConfig;
}

function EmbeddedScatterPlot({
  data,
  height,
  linreg_by_group,
  plotConfig,
}: Props) {
  const { plotStyles } = useDataExplorerSettings();
  const { pointSize, pointOpacity, outlineWidth, palette } = plotStyles;

  const {
    formattedData,
    contLegendKeys,
    colorMap,
    legendForDownload,
    pointVisibility,
    regressionLines,
    showIdentityLine,
  } = useScatterPlotData(data, plotConfig, linreg_by_group, palette);

  if (!formattedData) {
    return null;
  }

  return (
    <PlotlyLoaderProvider PlotlyLoader={ScatterLoader}>
      <PrototypeScatterPlot
        data={formattedData}
        xKey="x"
        yKey="y"
        pointVisibility={pointVisibility || undefined}
        colorKey1="color1"
        colorKey2="color2"
        categoricalColorKey="catColorData"
        continuousColorKey="contColorData"
        contLegendKeys={contLegendKeys}
        colorMap={colorMap}
        hoverTextKey="hoverText"
        annotationTextKey="annotationText"
        height={height}
        xLabel={formattedData.xLabel || ""}
        yLabel={formattedData.yLabel || ""}
        showIdentityLine={showIdentityLine}
        regressionLines={regressionLines}
        onClickResetSelection={() => {}}
        legendForDownload={legendForDownload}
        pointSize={pointSize}
        pointOpacity={pointOpacity}
        outlineWidth={outlineWidth}
        palette={palette}
        xAxisFontSize={12}
        yAxisFontSize={12}
      />
    </PlotlyLoaderProvider>
  );
}

export default EmbeddedScatterPlot;
