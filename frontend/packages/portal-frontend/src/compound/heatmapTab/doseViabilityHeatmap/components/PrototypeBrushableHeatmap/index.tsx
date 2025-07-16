import React from "react";
import PlotlyLoader from "src/plot/components/PlotlyLoader";
import type { InteractiveHeatmapProps } from "./types";
import StaticBrushableHeatmap from "./StaticBrushableHeatmap";
import InteractiveBrushableHeatmap from "./InteractiveBrushableHeatmap";

export default function LazyPrototypeBrushableHeatmap({
  data,
  interactiveVersion = true,
  ...otherProps
}: InteractiveHeatmapProps) {
  return (
    <PlotlyLoader version="module">
      {(Plotly) => {
        if (!data) return null;
        if (interactiveVersion) {
          return (
            <InteractiveBrushableHeatmap
              data={data}
              Plotly={Plotly}
              interactiveVersion={interactiveVersion}
              {...otherProps}
            />
          );
        }
        return (
          <StaticBrushableHeatmap data={data} Plotly={Plotly} {...otherProps} />
        );
      }}
    </PlotlyLoader>
  );
}
// ...existing code...
