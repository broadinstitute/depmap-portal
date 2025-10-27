import React, { useEffect, useState } from "react";
import { Tooltip, WordBreaker } from "@depmap/common-components";
import { isSampleType, pluralize, useDimensionType } from "../../utils/misc";
import {
  State,
  SLICE_TYPE_NULL,
  SliceTypeNull,
} from "./useDimensionStateManager/types";
import { fetchDimensionTypeDisplayName } from "./api-helpers";
import PlotConfigSelect from "../PlotConfigSelect";
import styles from "../../styles/DimensionSelect.scss";

interface Props {
  isLoading: boolean;
  index_type: string | null;
  axis_type: "raw_slice" | "aggregated_slice";
  aggregation: string | null;
  isUnknownDataset: boolean;
  options: State["sliceTypeOptions"];
  value: string | null | undefined;
  onChange: (nextSliceType: string | SliceTypeNull | undefined) => void;
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
  isUnknownDataset,
  aggregation,
  options,
  value,
  onChange,
}: Props) {
  const [sliceTypeLabel, setSliceTypeLabel] = useState("");
  const label = useLabel(index_type, axis_type, aggregation);

  let placeholder = isLoading
    ? "Loading…"
    : `Select ${isSampleType(index_type) ? "feature" : "sample"} type…`;

  if (isUnknownDataset) {
    placeholder = `(Unknown ${
      isSampleType(index_type) ? "feature" : "sample"
    } type)`;
  }

  useEffect(() => {
    if (!value) {
      setSliceTypeLabel("");
      return;
    }

    fetchDimensionTypeDisplayName(value).then((displayName) => {
      setSliceTypeLabel(displayName);
    });
  }, [value]);

  let displayValue =
    value === undefined ? null : ({ value, label: sliceTypeLabel } as any);

  if (value === null) {
    displayValue = {
      value: SLICE_TYPE_NULL,
      label: SLICE_TYPE_NULL.toString(),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any;
  }

  return (
    <PlotConfigSelect
      show
      isClearable
      enable={!isLoading}
      label={label}
      placeholder={placeholder}
      isLoading={isLoading}
      value={displayValue}
      options={isLoading ? [{ label: sliceTypeLabel, value }] : options}
      onChangeUsesWrappedValue
      onChange={(wrapper) => {
        // HACK: Use `undefined` instead of `null` to clear the select (since
        // `null` is a valid slice_type0.
        onChange((wrapper as any)?.value || undefined);
      }}
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
