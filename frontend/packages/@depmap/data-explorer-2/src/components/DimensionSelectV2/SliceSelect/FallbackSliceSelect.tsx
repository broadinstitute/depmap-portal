import React from "react";
import { DataExplorerContextV2 } from "@depmap/types";
import PlotConfigSelect from "../../PlotConfigSelect";
import { useLabel } from "./hooks";
import { getIdentifier } from "./utils";

interface Props {
  index_type: string | null;
  value: DataExplorerContextV2 | null;
  onChange: (context: DataExplorerContextV2 | null) => void;
  selectClassName?: string;
}

function FallbackSliceSelect({
  index_type,
  value,
  onChange,
  selectClassName = undefined,
}: Props) {
  const label = useLabel(index_type);

  const displayValue = !value
    ? null
    : { value: getIdentifier(value) as string, label: value.name };

  return (
    <PlotConfigSelect
      show
      enable
      isClearable
      // TODO: Handle when user tries to clear this.
      onChange={(nextValue: string | null) => {
        if (nextValue === null) {
          onChange(null);
        }
      }}
      label={label}
      className={selectClassName}
      value={displayValue}
      options={displayValue ? [displayValue] : []}
    />
  );
}

export default FallbackSliceSelect;
