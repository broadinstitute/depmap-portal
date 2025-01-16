import React, { useState } from "react";
import {
  convertDimensionToSliceId,
  DatasetMetadataSelector,
  DimensionSelect,
  PlotConfigSelect,
} from "@depmap/data-explorer-2";
import styles from "../styles/cell_line_selector.scss";

interface Props {
  onChange: (
    sliceId: string | null,
    valueType: "continuous" | "categorical"
  ) => void;
}

function DataColumnSelect({ onChange }: Props) {
  const [valueType, setValueType] = useState<
    "continuous" | "categorical" | null
  >(null);
  const [value, setValue] = useState<string | null>(null);

  return (
    <div>
      <PlotConfigSelect
        show
        enable
        placeholder="Choose source…"
        value={valueType}
        onChange={(nextValueType) => {
          setValueType(nextValueType as "continuous" | "categorical");
          onChange(null, nextValueType as "continuous" | "categorical");
          setValue(null);
        }}
        options={{
          categorical: "Model Property",
          continuous: "Matrix Data",
        }}
      />
      {valueType === "continuous" && (
        <DimensionSelect
          className={styles.DimensionSelect}
          mode="entity-only"
          index_type="depmap_model"
          value={null}
          onChange={(dimension) => {
            const sliceId = convertDimensionToSliceId(dimension);
            onChange(sliceId, valueType);
          }}
        />
      )}
      {valueType === "categorical" && (
        <DatasetMetadataSelector
          show
          enable
          slice_type="depmap_model"
          value={value}
          onChange={(partialOrCompleteSliceId: string | null) => {
            setValue(partialOrCompleteSliceId);

            if (
              partialOrCompleteSliceId &&
              partialOrCompleteSliceId.split("/").length === 4
            ) {
              onChange(partialOrCompleteSliceId, valueType);
            } else {
              onChange(null, valueType);
            }
          }}
        />
      )}
    </div>
  );
}

export default DataColumnSelect;
