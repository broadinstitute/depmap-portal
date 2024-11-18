import React from "react";
import { Tooltip, WordBreaker } from "@depmap/common-components";
import PlotConfigSelect from "../PlotConfigSelect";
import styles from "../../styles/DimensionSelect.scss";

interface Props {
  isLoading: boolean;
  options: { label: string; value: string; isDisabled: boolean }[];
  value: string | null;
  onChange: (nextDataType: string | null) => void;
  hasError?: boolean;
}

function DataTypeSelect({
  isLoading,
  options,
  value,
  onChange,
  hasError = false,
}: Props) {
  const placeholder = isLoading ? "Loading…" : "Select data type…";

  return (
    <PlotConfigSelect
      show
      enable={options.length > 1 && !isLoading}
      isClearable
      label="Data Type"
      hasError={hasError}
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
              id="disabled-data-type"
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

export default DataTypeSelect;
