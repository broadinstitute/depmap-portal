import React from "react";
import usePlotData from "@depmap/data-explorer-2/src/components/DataExplorerPage/hooks/usePlotData";
import { DataExplorerPlotConfig } from "@depmap/types";
import LoadingSpinner from "../LoadingSpinner";
import EmbeddedDensity1DPlot from "./EmbeddedDensity1DPlot";
import EmbeddedWaterfallPlot from "./EmbeddedWaterfallPlot";
import EmbeddedScatterPlot from "./EmbeddedScatterPlot";
import EmbeddedCorrelationHeatmap from "./EmbeddedCorrelationHeatmap";

interface Props {
  plotConfig?: DataExplorerPlotConfig | null;
  height: number;
}

function Plot({ plotConfig = null, height }: Props) {
  const {
    data,
    linreg_by_group,
    // fetchedPlotConfig,
    // hadError,
    // errorMessage,
  } = usePlotData(plotConfig);

  if (!data || !plotConfig) {
    return <LoadingSpinner />;
  }

  switch (plotConfig.plot_type) {
    case "density_1d":
      return (
        <EmbeddedDensity1DPlot
          data={data}
          height={height}
          plotConfig={plotConfig}
        />
      );

    case "scatter":
      return (
        <EmbeddedScatterPlot
          data={data}
          height={height}
          linreg_by_group={linreg_by_group}
          plotConfig={plotConfig}
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

export default Plot;
