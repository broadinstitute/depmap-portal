import React from "react";
import { PlotConfigSelect } from "@depmap/data-explorer-2";

interface Props {
  value: "property" | "custom";
  onChange: (nextValue: "property" | "custom") => void;
}

function DataSourceSelect({ value, onChange }: Props) {
  return (
    <PlotConfigSelect
      show
      enable
      value={value}
      options={{ property: "Annotation", custom: "Dataset" }}
      onChange={onChange as (value: string | null) => void}
      label="Data Source"
      placeholder="Select data source…"
      menuPortalTarget={document.querySelector("#modal-container")}
    />
  );
}

export default DataSourceSelect;
