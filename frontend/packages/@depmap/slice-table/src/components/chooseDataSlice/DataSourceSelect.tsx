import React from "react";
import { PlotConfigSelect } from "@depmap/data-explorer-2";

interface Props {
  value: "metadata_column" | "matrix_dataset" | null;
  onChange: (nextValue: "metadata_column" | "matrix_dataset") => void;
}

function DataSourceSelect({ value, onChange }: Props) {
  return (
    <PlotConfigSelect
      show
      enable
      label="Data Source"
      value={value}
      options={[
        {
          label: "Annotation",
          value: "metadata_column",
        },
        {
          label: "Matrix Dataset",
          value: "matrix_dataset",
        },
      ]}
      onChange={onChange as (value: string | null) => void}
      placeholder="Select data source…"
      menuPortalTarget={document.querySelector("#modal-container")}
    />
  );
}

export default DataSourceSelect;
