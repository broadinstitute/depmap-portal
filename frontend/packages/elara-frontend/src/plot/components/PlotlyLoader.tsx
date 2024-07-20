import React, { useEffect, useState, ReactElement } from "react";
import { Spinner } from "@depmap/common-components";

export type PlotlyType = typeof import("plotly.js");

interface Props {
  children: (Plotly: PlotlyType) => ReactElement;
}

function PlotlyLoader({ children }: Props) {
  const [Plotly, setPlotly] = useState<PlotlyType | null>(null);

  useEffect(() => {
    (async () => {
      const lib = (
        await import(
          // webpackChunkName: "custom-plotly"
          "../models/custom-plotly" as any
        )
      ).default;

      setPlotly(lib);
    })();
  }, []);

  return Plotly ? children(Plotly) : <Spinner />;
}

export default PlotlyLoader;
