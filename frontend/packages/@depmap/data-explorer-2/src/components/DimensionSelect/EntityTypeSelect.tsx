import React from "react";
import { Tooltip, WordBreaker } from "@depmap/common-components";
import {
  capitalize,
  getDimensionTypeLabel,
  isSampleType,
  pluralize,
} from "../../utils/misc";
import PlotConfigSelect from "../PlotConfigSelect";
import styles from "../../styles/DimensionSelect.scss";

interface Props {
  isLoading: boolean;
  index_type: string | null;
  axis_type: "entity" | "context";
  aggregation: string | null;
  options: { label: string; value: string; isDisabled: boolean }[];
  value: string | null;
  onChange: (nextEntityType: string | null) => void;
}

function EntityTypeSelect({
  isLoading,
  index_type,
  axis_type,
  aggregation,
  options,
  value,
  onChange,
}: Props) {
  const placeholder = isLoading
    ? "Loading…"
    : `Select ${isSampleType(index_type) ? "feature" : "sample"} type…`;

  let label = isSampleType(index_type) ? "Feature" : "Sample";

  if (axis_type === "context") {
    label = `${pluralize(label)} to ${
      aggregation === "correlation" ? "correlate" : "aggregate"
    }`;
  }

  const entityTypeLabel = value ? capitalize(getDimensionTypeLabel(value)) : "";

  return (
    <PlotConfigSelect
      show
      isClearable
      enable={options.length > 1}
      label={label}
      placeholder={placeholder}
      isLoading={isLoading}
      value={value}
      options={isLoading ? [{ label: entityTypeLabel, value }] : options}
      onChange={onChange}
      formatOptionLabel={(option: {
        label: string;
        isDisabled: boolean;
        disabledReason: string;
      }) => {
        if (option.isDisabled) {
          return (
            <Tooltip
              id="disabled-entity-type"
              className={styles.unblockable}
              content={<WordBreaker text={option.disabledReason} />}
              placement="top"
            >
              <span style={{ cursor: "not-allowed" }}>{option.label}</span>
            </Tooltip>
          );
        }

        return option.label;
      }}
    />
  );
}

export default EntityTypeSelect;
