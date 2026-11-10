import React from "react";
import usePlotData from "@depmap/data-explorer-2/src/components/DataExplorerPage/hooks/usePlotData";
import {
  DataExplorerPlotConfig,
  DataExplorerPlotResponse,
  LinRegInfo,
} from "@depmap/types";
import LoadingSpinner from "../LoadingSpinner";
import EmbeddedDensity1DPlot from "./EmbeddedDensity1DPlot";
import EmbeddedWaterfallPlot from "./EmbeddedWaterfallPlot";
import EmbeddedScatterPlot from "./EmbeddedScatterPlot";
import type { PlotSelection } from "./PlotSelection";
import EmbeddedCorrelationHeatmap from "./EmbeddedCorrelationHeatmap";

interface PlotViewProps {
  plotConfig: DataExplorerPlotConfig;
  data: DataExplorerPlotResponse;
  linreg_by_group?: LinRegInfo[] | null;
  height: number;
  // Scatter and density_1d only; other plot types ignore it.
  selection?: PlotSelection;
}

// Presentational only: renders already-fetched data. Shared by every surface,
// whether the data came from the browser or from POST /temp/plot-data.
export function PlotView({
  plotConfig,
  data,
  linreg_by_group = null,
  height,
  selection = undefined,
}: PlotViewProps) {
  switch (plotConfig.plot_type) {
    case "density_1d":
      return (
        <EmbeddedDensity1DPlot
          data={data}
          height={height}
          plotConfig={plotConfig}
          selection={selection}
        />
      );

    case "scatter":
      return (
        <EmbeddedScatterPlot
          data={data}
          height={height}
          linreg_by_group={linreg_by_group}
          plotConfig={plotConfig}
          selection={selection}
        />
      );

    case "waterfall":
      return (
        <EmbeddedWaterfallPlot
          data={data}
          height={height}
          plotConfig={plotConfig}
        />
      );

    case "correlation_heatmap":
      return (
        <EmbeddedCorrelationHeatmap
          data={data}
          height={height}
          plotConfig={plotConfig}
        />
      );

    default:
      return null;
  }
}

interface Props {
  plotConfig?: DataExplorerPlotConfig | null;
  height: number;
}

function Plot({ plotConfig = null, height }: Props) {
  const { data, linreg_by_group } = usePlotData(plotConfig);

  if (!data || !plotConfig) {
    return <LoadingSpinner />;
  }

  return (
    <PlotView
      plotConfig={plotConfig}
      data={data}
      linreg_by_group={linreg_by_group}
      height={height}
    />
  );
}

export default Plot;
