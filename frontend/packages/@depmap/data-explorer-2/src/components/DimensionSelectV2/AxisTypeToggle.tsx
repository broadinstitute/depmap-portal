import React from "react";
import renderConditionally from "../../utils/render-conditionally";
import { ToggleSwitch } from "@depmap/common-components";
import styles from "../../styles/DimensionSelect.scss";

interface Props {
  value: "raw_slice" | "aggregated_slice";
  onChange: (nextValue: "raw_slice" | "aggregated_slice") => void;
  disabled?: boolean;
}

type ToggleOption = { label: string; value: "raw_slice" | "aggregated_slice" };

const toggleOptions = [
  { label: "Single", value: "raw_slice" },
  { label: "Multiple", value: "aggregated_slice" },
] as [ToggleOption, ToggleOption];

const AxisTypeToggle = renderConditionally(
  ({ value, onChange, disabled = false }: Props) => {
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
);

export default AxisTypeToggle;
