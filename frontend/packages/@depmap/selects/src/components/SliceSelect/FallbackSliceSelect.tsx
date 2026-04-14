import React from "react";
import ReactWindowedSelect from "react-windowed-select";
import extendReactSelect from "../../utils/extend-react-select";
import { SliceSelection } from "./types";

const Select = extendReactSelect(ReactWindowedSelect);

interface Props {
  value: SliceSelection | null;
  onChange: (selection: SliceSelection | null) => void;
  label?: string;
  selectClassName?: string;
  menuPortalTarget?: HTMLElement | null;
}

function FallbackSliceSelect({
  value,
  onChange,
  label = "Dimension",
  selectClassName = undefined,
  menuPortalTarget = undefined,
}: Props) {
  const displayValue = !value ? null : { value: value.id, label: value.label };

  return (
    <Select
      label={label}
      className={selectClassName}
      value={displayValue}
      options={displayValue ? [displayValue] : []}
      isClearable
      menuPortalTarget={menuPortalTarget}
      onChange={(
        nextValue: { value: string; label: string } | null | undefined
      ) => {
        if (nextValue === null) {
          onChange(null);
        }
      }}
    />
  );
}

export default FallbackSliceSelect;
