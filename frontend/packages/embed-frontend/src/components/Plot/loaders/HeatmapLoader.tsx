import React, { useEffect, useState, ReactElement } from "react";
import LoadingSpinner from "../../../components/LoadingSpinner";

export type PlotlyType = typeof import("plotly.js");

interface Props {
  children?: (Plotly: PlotlyType) => ReactElement;
}

function HeatmapLoader({ children = undefined }: Props) {
  const [Plotly, setPlotly] = useState<PlotlyType | null>(null);

  useEffect(() => {
    (async () => {
      const lib = (
        await import(
          // webpackChunkName: "plotly-bundles__heatmap"
          "../../../plotly-bundles/heatmap"
        )
      ).default;

      setPlotly(lib);
    })();
  }, []);

  return Plotly && children ? children(Plotly) : <LoadingSpinner />;
}

export default HeatmapLoader;
