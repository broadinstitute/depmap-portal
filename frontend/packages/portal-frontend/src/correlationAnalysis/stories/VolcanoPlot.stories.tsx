import * as React from "react";
import VolcanoPlot from "../components/VolcanoPlot";

export default {
  title: "Components/CorrelationAnalysis/VolcanoPlot",
  component: VolcanoPlot,
};

export function VolcanoPlotStory() {
  const sampleData = [
    {
      x: [-2, 0.5, 3],
      y: [5, 1, 7],
      label: ["Gene A", "Gene B", "Gene C"],
      name: "Trace 1",
    },
  ];

  return (
    <div>
      <h1>Volcano Plot Demo</h1>
      <VolcanoPlot
        data={sampleData}
        onPointClick={(point, keyMod) => {
          console.log("Clicked point:", point);
          if (keyMod) {
            console.log("KEY PRESSED!");
          }
        }}
      />
    </div>
  );
}
