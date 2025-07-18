import React, { useState } from "react";
import type { SliceQuery } from "@depmap/types";
import DataSourceSelect from "./DataSourceSelect";
import MetadataColumnSelect from "./MetadataColumnSelect";
import MatrixDataSelect from "./MatrixDataSelect";

interface Props {
  index_type_name: string;
  value: any;
  defaultValue: any;
  onChange: (nextValue: SliceQuery | null) => void;
}

function DataSliceSelect({
  index_type_name,
  value,
  defaultValue,
  onChange,
}: Props) {
  const [source, setSource] = useState(() => {
    if (["feature_id", "sample_id"].includes(defaultValue?.identifier_type)) {
      return "matrix_dataset" as const;
    }

    return "metadata_column" as const;
  });

  return (
    <div>
      <DataSourceSelect
        value={source}
        onChange={(nextSource) => {
          setSource(nextSource);
          onChange(null);
        }}
      />
      <div style={{ height: 10 }} />
      {source === "metadata_column" && (
        <MetadataColumnSelect
          value={value}
          index_type_name={index_type_name}
          onChange={onChange}
        />
      )}
      {source === "matrix_dataset" && (
        <MatrixDataSelect
          defaultValue={defaultValue}
          index_type_name={index_type_name}
          onChange={onChange}
        />
      )}
    </div>
  );
}

export default DataSliceSelect;
