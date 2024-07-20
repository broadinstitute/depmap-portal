import { useEffect } from "react";
import { PlotlyType } from "src/data-explorer-2/components/plot/PlotlyLoader";
import type ExtendedPlotType from "src/plot/models/ExtendedPlotType";

export default function usePlotResizer(
  Plotly: PlotlyType,
  ref: React.RefObject<ExtendedPlotType>
) {
  useEffect(() => {
    const plot = ref.current;

    const resizeObserver = new ResizeObserver(() => {
      if (plot) {
        Plotly.Plots.resize(plot);
      }
    });

    if (plot) {
      resizeObserver.observe(plot);
    }

    return () => {
      if (plot) {
        resizeObserver.unobserve(plot);
      }

      resizeObserver.disconnect();
    };
  }, [Plotly, ref]);
}
