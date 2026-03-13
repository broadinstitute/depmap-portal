import React, { useState } from "react";
import type { SliceQuery } from "@depmap/types";
import DataSourceSelect from "./DataSourceSelect";
import AddColumnAnnotationSelect from "./AddColumnAnnotationSelect";
import AddColumnDimensionSelect from "./AddColumnDimensionSelect";

interface Props {
  index_type_name: string;
  idColumnLabel: string;
  value: SliceQuery | null;
  defaultValue: SliceQuery | null;
  onChange: (nextValue: SliceQuery | null) => void;
  initialSource: "property" | "custom";
  existingSlices?: SliceQuery[];
  hiddenDatasets?: Set<string>;
}

function DataSliceSelect({
  index_type_name,
  idColumnLabel,
  defaultValue,
  initialSource,
  value,
  onChange,
  existingSlices = undefined,
  hiddenDatasets = undefined,
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
          idColumnLabel={idColumnLabel}
          onChange={onChange}
          existingSlices={existingSlices}
          hiddenDatasets={hiddenDatasets}
        />
      )}
      {source === "custom" && (
        <AddColumnDimensionSelect
          defaultValue={defaultValue}
          index_type_name={index_type_name}
          onChange={onChange}
          hiddenDatasets={hiddenDatasets}
        />
      )}
    </div>
  );
}

export default DataSliceSelect;
