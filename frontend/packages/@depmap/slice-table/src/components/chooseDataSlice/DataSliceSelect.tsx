import React, { useState } from "react";
import type { SliceQuery } from "@depmap/types";
import DataSourceSelect from "./DataSourceSelect";
import AddColumnAnnotationSelect from "./AddColumnAnnotationSelect";
import AddColumnDimensionSelect from "./AddColumnDimensionSelect";

interface Props {
  index_type_name: string;
  value: SliceQuery | null;
  defaultValue: SliceQuery | null;
  onChange: (nextValue: SliceQuery | null) => void;
  initialSource: "property" | "custom";
}

function DataSliceSelect({
  index_type_name,
  defaultValue,
  initialSource,
  value,
  onChange,
}: Props) {
  const [source, setSource] = useState(initialSource);

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
      {source === "property" && (
        <AddColumnAnnotationSelect
          value={value}
          index_type_name={index_type_name}
          onChange={onChange}
        />
      )}
      {source === "custom" && (
        <AddColumnDimensionSelect
          defaultValue={defaultValue}
          index_type_name={index_type_name}
          onChange={onChange}
        />
      )}
    </div>
  );
}

export default DataSliceSelect;
