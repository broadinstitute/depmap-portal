import React from "react";
import renderConditionally from "../../utils/render-conditionally";
import { ToggleSwitch } from "@depmap/common-components";
import styles from "../../styles/DimensionSelect.scss";

interface Props {
  value: "entity" | "context";
  onChange: (nextValue: "entity" | "context") => void;
  disabled?: boolean;
}

type ToggleOption = { label: string; value: "entity" | "context" };

const toggleOptions = [
  { label: "Single", value: "entity" },
  { label: "Multiple", value: "context" },
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
