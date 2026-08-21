import React from "react";
import { ToggleSwitch } from "@depmap/common-components";
import renderConditionally from "../../utils/render-conditionally";
import styles from "../../styles/DimensionSelect.scss";

interface Props {
  value: "aggregate" | "expand";
  onChange: (nextValue: "expansion" | "mean") => void;
  isExpansionDisabled: boolean;
  // Why expansion is unavailable, shown on hover. Only used when
  // `isExpansionDisabled` — a toggle that refuses to move without saying why
  // reads as broken.
  disabledReason?: string;
}

type ToggleOption = { label: string; value: "aggregate" | "expand" };

const toggleOptions = [
  { label: "Aggregate", value: "aggregate" },
  { label: "Facet", value: "expand" },
] as [ToggleOption, ToggleOption];

function AggregateOrExpandToggle({
  value,
  onChange,
  isExpansionDisabled,
  disabledReason = undefined,
}: Props) {
  return (
    <span title={isExpansionDisabled ? disabledReason : undefined}>
      <ToggleSwitch
        className={styles.AggregateOrExpandToggle}
        disabled={isExpansionDisabled}
        value={value}
        options={toggleOptions}
        onChange={(nextValue) => {
          onChange(nextValue === "expand" ? "expansion" : "mean");
        }}
      />
    </span>
  );
}

export default renderConditionally(AggregateOrExpandToggle);
