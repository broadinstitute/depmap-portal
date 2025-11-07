import React, { useEffect, useState } from "react";
import { breadboxAPI, cached } from "@depmap/api";
import { ToggleSwitch } from "@depmap/common-components";
import renderConditionally from "../../utils/render-conditionally";
import styles from "../../styles/DimensionSelect.scss";

interface Props {
  value: "raw_slice" | "aggregated_slice";
  onChange: (nextValue: "raw_slice" | "aggregated_slice") => void;
  slice_type: string | null | undefined;
  dataset_id: string | undefined;
}

type ToggleOption = { label: string; value: "raw_slice" | "aggregated_slice" };

const toggleOptions = [
  { label: "Single", value: "raw_slice" },
  { label: "Multiple", value: "aggregated_slice" },
] as [ToggleOption, ToggleOption];

function AxisTypeToggle({ value, onChange, slice_type, dataset_id }: Props) {
  const [disabled, setDisabled] = useState(slice_type === null);

  useEffect(() => {
    if (slice_type === null) {
      setDisabled(true);
      return;
    }

    if (dataset_id) {
      cached(breadboxAPI)
        .getDataset(dataset_id)
        .then((dataset) => {
          setDisabled(
            dataset.format === "matrix_dataset" &&
              dataset.value_type !== "continuous"
          );
        });
    } else {
      setDisabled(false);
    }
  }, [dataset_id, slice_type]);

  return (
    <ToggleSwitch
      className={styles.AxisTypeToggle}
      value={value}
      onChange={onChange}
      disabled={disabled}
      options={toggleOptions}
    />
  );
}

export default renderConditionally(AxisTypeToggle);
