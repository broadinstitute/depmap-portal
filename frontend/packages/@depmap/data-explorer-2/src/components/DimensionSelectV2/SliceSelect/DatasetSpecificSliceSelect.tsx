import React, { useEffect, useRef, useState } from "react";
import { DataExplorerContextV2 } from "@depmap/types";
import PlotConfigSelect from "../../PlotConfigSelect";
import { fetchDatasetIdentifiers } from "../api-helpers";
import { SLICE_TYPE_NULL } from "../useDimensionStateManager/types";
import { getIdentifier, toOutputValue } from "./utils";
import formatOptionLabel from "./formatOptionLabel";

type Option = { label: string; value: string };

interface Props {
  dataset_id: string | null;
  value: DataExplorerContextV2 | null;
  onChange: (context: DataExplorerContextV2 | null) => void;
}

function DatasetSpecificSliceSelect({ dataset_id, value, onChange }: Props) {
  const [isLoading, setIsLoading] = useState(false);
  const [options, setOptions] = useState<Option[]>([]);

  const searchQuery = useRef("");

  useEffect(() => {
    searchQuery.current = "";
  }, [dataset_id]);

  useEffect(() => {
    if (dataset_id) {
      setIsLoading(true);

      fetchDatasetIdentifiers(SLICE_TYPE_NULL, dataset_id).then(
        (identifiers) => {
          setOptions(
            identifiers.map(({ id, label }) => ({ value: id, label }))
          );
          setIsLoading(false);
        }
      );
    } else {
      setOptions([]);
      setIsLoading(false);
    }
  }, [dataset_id]);

  if (!dataset_id) {
    return null;
  }

  const displayValue = !value
    ? null
    : { value: getIdentifier(value) as string, label: value.name };

  return (
    <PlotConfigSelect
      show
      enable
      isClearable
      label="Feature"
      placeholder="Select a feature…"
      menuWidth={310}
      isLoading={isLoading}
      value={displayValue}
      options={options}
      formatOptionLabel={formatOptionLabel}
      onChangeUsesWrappedValue
      onChange={(selectedOption) => {
        onChange(
          toOutputValue(
            null,
            selectedOption as Option | null
          ) as DataExplorerContextV2 | null
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
