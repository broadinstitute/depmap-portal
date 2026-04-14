import React, { useEffect, useRef, useState } from "react";
import ReactWindowedSelect from "react-windowed-select";
import extendReactSelect from "../../utils/extend-react-select";
import { SliceSelection } from "./types";
import { fetchDatasetFeatures } from "./api-helpers";
import formatOptionLabel from "./formatOptionLabel";

type Option = { label: string; value: string };

const Select = extendReactSelect(ReactWindowedSelect);

interface Props {
  dataset_id: string | null;
  value: SliceSelection | null;
  onChange: (selection: SliceSelection | null) => void;
  label?: string;
  placeholder?: string;
  selectClassName?: string;
  menuPortalTarget?: HTMLElement | null;
}

function DatasetSpecificSliceSelect({
  dataset_id,
  value,
  onChange,
  label = "Feature",
  placeholder = "Select a feature…",
  selectClassName = undefined,
  menuPortalTarget = undefined,
}: Props) {
  const [isLoading, setIsLoading] = useState(false);
  const [options, setOptions] = useState<Option[]>([]);

  const searchQuery = useRef("");

  useEffect(() => {
    searchQuery.current = "";
  }, [dataset_id]);

  useEffect(() => {
    if (dataset_id) {
      setIsLoading(true);

      fetchDatasetFeatures(dataset_id).then((identifiers) => {
        setOptions(
          identifiers.map(({ id, label: idLabel }) => ({
            value: id,
            label: idLabel,
          }))
        );
        setIsLoading(false);
      });
    } else {
      setOptions([]);
      setIsLoading(false);
    }
  }, [dataset_id]);

  if (!dataset_id) {
    return null;
  }

  const displayValue = !value ? null : { value: value.id, label: value.label };

  return (
    <Select
      label={label}
      className={selectClassName}
      placeholder={placeholder}
      menuWidth={310}
      isLoading={isLoading}
      value={displayValue}
      options={options}
      formatOptionLabel={formatOptionLabel}
      isClearable
      menuPortalTarget={menuPortalTarget}
      onChange={(selectedOption: Option | null | undefined) => {
        onChange(
          selectedOption
            ? { id: selectedOption.value, label: selectedOption.label }
            : null
        );
      }}
      isEditable
      editableInputValue={searchQuery.current}
      onEditInputValue={(editedText: string) => {
        searchQuery.current = editedText;
      }}
    />
  );
}

export default DatasetSpecificSliceSelect;
