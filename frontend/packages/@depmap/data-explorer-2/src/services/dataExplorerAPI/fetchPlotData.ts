import {
  DataExplorerExpandedPlotConfig,
  DataExplorerPlotConfig,
  DataExplorerPlotResponse,
  LinRegInfo,
} from "@depmap/types";
import { isExpansionDimension } from "../../utils/dimensionHelpers";
import {
  fetchCorrelation,
  fetchLinearRegression,
  fetchPlotDimensions,
  fetchWaterfall,
} from "./standardPlot";
import { fetchExpandedPlot, fetchExpandedWaterfall } from "./expandedPlot";

// The single entry point for "give me the data behind this plot config". It
// picks the right fetcher for the config's shape, so callers (the Data Explorer
// page, and the standalone Node bundle) never have to know about the
// expanded/correlation/waterfall/plain split.
export async function fetchPlotData(
  plotConfig: DataExplorerPlotConfig
): Promise<DataExplorerPlotResponse> {
  if ("expand_by" in plotConfig) {
    // A config with `expand_by` is a DataExplorerExpandedPlotConfig, which the
    // declared parameter type doesn't capture.
    const expandedConfig = (plotConfig as unknown) as DataExplorerExpandedPlotConfig;

    return plotConfig.plot_type === "waterfall"
      ? fetchExpandedWaterfall(expandedConfig)
      : fetchExpandedPlot(expandedConfig);
  }

  if (plotConfig.plot_type === "correlation_heatmap") {
    return fetchCorrelation(
      plotConfig.index_type,
      plotConfig.dimensions,
      plotConfig.filters,
      plotConfig.use_clustering
    );
  }

  if (plotConfig.plot_type === "waterfall") {
    return fetchWaterfall(
      plotConfig.index_type,
      plotConfig.dimensions,
      plotConfig.filters,
      plotConfig.metadata
    );
  }

  return fetchPlotDimensions(
    plotConfig.index_type,
    plotConfig.dimensions,
    plotConfig.filters,
    plotConfig.metadata
  );
}

// The regression fit shown alongside a scatter plot. It's separate from
// fetchPlotData because the page renders the plot first and the fit when it
// arrives. Resolves to null when the config doesn't call for one.
export async function fetchPlotLinearRegression(
  plotConfig: DataExplorerPlotConfig
): Promise<LinRegInfo[] | null> {
  if (
    !plotConfig.show_regression_line ||
    !plotConfig.dimensions.x ||
    !plotConfig.dimensions.y ||
    // Expanded plots get their fit from the faceted regression path;
    // fetchLinearRegression assumes one value per index entity, so skip it
    // when any axis carries the "expansion" sentinel (it would otherwise
    // throw at the aggregate materializer).
    Object.values(plotConfig.dimensions).some(isExpansionDimension)
  ) {
    return null;
  }

  return fetchLinearRegression(
    plotConfig.index_type,
    plotConfig.dimensions,
    plotConfig.filters,
    plotConfig.metadata
  );
}
