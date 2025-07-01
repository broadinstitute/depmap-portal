import { useEffect } from "react";
import type Plotly from "plotly.js";

type PlotlyType = typeof Plotly;

export default function usePlotResizer(
  Plotly: PlotlyType,
  ref: React.RefObject<HTMLDivElement>
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
