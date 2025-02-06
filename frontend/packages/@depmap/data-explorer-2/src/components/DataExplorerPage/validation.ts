import { isCompleteDimension } from "../../utils/misc";
import {
  DataExplorerPlotConfig,
  DataExplorerPlotConfigDimension,
  DimensionKey,
  PartialDataExplorerPlotConfig,
} from "@depmap/types";

export function isCompletePlot(
  plot?: PartialDataExplorerPlotConfig | null
): plot is DataExplorerPlotConfig {
  if (!plot) {
    return false;
  }

  const { plot_type, index_type, dimensions } = plot;

  if (!plot_type || !index_type || !dimensions) {
    return false;
  }

  const numAxisDimensions = ({
    density_1d: 1,
    waterfall: 1,
    scatter: 2,
    correlation_heatmap: 1,
  } as Record<string, number>)[plot_type];

  return (
    Object.keys(dimensions).length >= numAxisDimensions &&
    (["x", "y"] as DimensionKey[])
      .slice(0, numAxisDimensions)
      .every((dimensionKey) => {
        const dimension = plot.dimensions![dimensionKey];

        return isCompleteDimension(
          dimension as Partial<DataExplorerPlotConfigDimension>
        );
      })
  );
}
