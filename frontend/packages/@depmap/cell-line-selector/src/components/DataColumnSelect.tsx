import React, { useState } from "react";
import {
  convertDimensionToSliceId,
  DatasetMetadataSelector,
  DimensionSelect,
  PlotConfigSelect,
  useDeprecatedDataExplorerApi,
} from "@depmap/data-explorer-2";
import styles from "../styles/cell_line_selector.scss";

interface Props {
  onChange: (
    sliceId: string | null,
    valueType: "continuous" | "categorical",
    api: ReturnType<typeof useDeprecatedDataExplorerApi>
  ) => void;
}

function DataColumnSelect({ onChange }: Props) {
  const api = useDeprecatedDataExplorerApi();
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
          onChange(null, nextValueType as "continuous" | "categorical", api);
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
          valueTypes={DimensionSelect.CONTINUOUS_ONLY}
          value={null}
          onChange={(dimension) => {
            const sliceId = convertDimensionToSliceId(dimension);
            onChange(sliceId, valueType, api);
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
              onChange(partialOrCompleteSliceId, valueType, api);
            } else {
              onChange(null, valueType, api);
            }
          }}
        />
      )}
    </div>
  );
}

export default DataColumnSelect;
