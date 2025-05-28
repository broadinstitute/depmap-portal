import React from "react";
import { Tooltip, WordBreaker } from "@depmap/common-components";
import PlotConfigSelect from "../PlotConfigSelect";
import styles from "../../styles/DimensionSelect.scss";

interface Props {
  show: boolean;
  isLoading: boolean;
  options: { label: string; value: string; isDisabled: boolean }[];
  value: string | null;
  onChange: (nextDataType: string | null) => void;
}

function UnitsSelect({ show, isLoading, options, value, onChange }: Props) {
  const placeholder = isLoading ? "Loading…" : "Select measure…";

  return (
    <PlotConfigSelect
      show={show}
      enable
      isClearable
      label="Measure (optional)"
      placeholder={placeholder}
      isLoading={isLoading}
      value={value}
      options={options}
      onChange={onChange}
      formatOptionLabel={(option: {
        label: string;
        isDisabled: boolean;
        disabledReason: string;
      }) => {
        if (option.isDisabled) {
          return (
            <Tooltip
              id="disabled-units"
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

export default UnitsSelect;
