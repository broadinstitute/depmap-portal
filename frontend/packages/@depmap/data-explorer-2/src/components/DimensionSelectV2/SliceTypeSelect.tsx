import React from "react";
import { Tooltip, WordBreaker } from "@depmap/common-components";
import {
  capitalize,
  getDimensionTypeLabel,
  isSampleType,
  pluralize,
  useDimensionType,
} from "../../utils/misc";
import PlotConfigSelect from "../PlotConfigSelect";
import styles from "../../styles/DimensionSelect.scss";

interface Props {
  isLoading: boolean;
  index_type: string | null;
  axis_type: "raw_slice" | "aggregated_slice";
  aggregation: string | null;
  options: { label: string; value: string; isDisabled: boolean }[];
  value: string | null;
  onChange: (nextSliceType: string | null) => void;
}

const useLabel = (
  index_type: string | null,
  axis_type: "raw_slice" | "aggregated_slice",
  aggregation: string | null
) => {
  const { dimensionType, isDimensionTypeLoading } = useDimensionType(
    index_type
  );

  if (isDimensionTypeLoading) {
    return "...";
  }

  let label = dimensionType?.axis === "sample" ? "Feature" : "Sample";

  if (axis_type === "aggregated_slice") {
    label = `${pluralize(label)} to ${
      aggregation === "correlation" ? "correlate" : "aggregate"
    }`;
  } else {
    label += " Type";
  }

  return label;
};

function SliceTypeSelect({
  isLoading,
  index_type,
  axis_type,
  aggregation,
  options,
  value,
  onChange,
}: Props) {
  const label = useLabel(index_type, axis_type, aggregation);

  const placeholder = isLoading
    ? "Loading…"
    : `Select ${isSampleType(index_type) ? "feature" : "sample"} type…`;

  const sliceTypeLabel = value ? capitalize(getDimensionTypeLabel(value)) : "";

  return (
    <PlotConfigSelect
      show
      isClearable
      enable={options.length > 1}
      label={label}
      placeholder={placeholder}
      isLoading={isLoading}
      value={value}
      options={isLoading ? [{ label: sliceTypeLabel, value }] : options}
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

export default SliceTypeSelect;
