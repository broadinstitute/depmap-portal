import React from "react";
import { PlotConfigSelect } from "@depmap/data-explorer-2";

interface Props {
  value: string | null;
  onChange: (nextValue: string) => void;
}

function PlotTypeSelect({ value, onChange }: Props) {
  return (
    <PlotConfigSelect
      show
      enable
      label="Plot Type"
      inlineLabel
      placeholder="Select type…"
      value={value}
      onChange={(nextValue) => onChange(nextValue as string)}
      options={{
        density_1d: "Density 1D",
        waterfall: "Waterfall",
        scatter: "Scatter plot",
      }}
    />
  );
}

export default PlotTypeSelect;
