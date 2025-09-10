import { useEffect, useState } from "react";
import type Plotly from "plotly.js";
import ExtendedPlotType from "src/plot/models/ExtendedPlotType";

type PlotlyType = typeof Plotly;

export default function usePlotResizer(
  Plotly: PlotlyType,
  ref: React.RefObject<ExtendedPlotType>,
  resizeCallback: (plot: ExtendedPlotType, isTabletLayout: boolean) => void
) {
  const [isTabletLayout, setIsTabletLayout] = useState<boolean>(
    window.innerWidth < 1250
  );
  console.log("isTabletLayout", isTabletLayout);
  console.log("HERE");

  useEffect(() => {
    const plot = ref.current;

    // Create a new ResizeObserver instance.
    const resizeObserver = new ResizeObserver(() => {
      if (plot) {
        const currentWidth = window.innerWidth;

        // Determine the new state.
        const newIsTabletLayout = currentWidth < 1250;

        // Check if the state has changed (i.e., the boundary was crossed).
        if (newIsTabletLayout !== isTabletLayout) {
          setIsTabletLayout(newIsTabletLayout); // Update the state.
          resizeCallback(plot, newIsTabletLayout); // Execute the callback.
        }
      }
    });

    // Start observing the document body for size changes.
    // The document body's size is equivalent to the viewport size.
    resizeObserver.observe(document.body);

    // Initial call to set up the plot based on the starting window width.
    if (plot) resizeCallback(plot, isTabletLayout);

    if (plot) {
      resizeObserver.observe(plot);
    }

    return () => {
      if (plot) {
        resizeObserver.unobserve(plot);
      }

      resizeObserver.disconnect();
    };
  }, [Plotly, ref, resizeCallback]);
}
