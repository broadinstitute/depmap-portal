import React, { useEffect, useMemo, useRef } from "react";
import VanillaAsycSelect from "react-select/async";
import { WindowedMenuList } from "react-windowed-select";
import { DataExplorerContextV2 } from "@depmap/types";
import extendReactSelect from "../../../utils/extend-react-select";
import {
  useDefaultOptions,
  useLabel,
  usePlaceholder,
  useSearch,
} from "./hooks";
import { getIdentifier, toOutputValue } from "./utils";
import formatOptionLabel from "./formatOptionLabel";

const AsyncSelect = extendReactSelect(VanillaAsycSelect);

interface Props {
  index_type: string | null;
  slice_type: string; // NOT compatible with SLICE_TYPE_NULL
  dataset_id: string | null;
  value: DataExplorerContextV2 | null;
  onChange: (context: DataExplorerContextV2 | null) => void;
  dataType: string | null;
  isLoading: boolean;
  //  units: string | null;
  swatchColor?: string;
  selectClassName?: string;
}

function SearchIndexAwareSliceSelect({
  index_type,
  dataType,
  slice_type,
  dataset_id,
  value,
  onChange,
  isLoading,
  swatchColor = undefined,
  selectClassName = undefined,
}: Props) {
  const searchQuery = useRef("");

  useEffect(() => {
    searchQuery.current = "";
  }, [slice_type, dataType, dataset_id]);

  const displayValue = !value
    ? null
    : { value: getIdentifier(value) as string, label: value.name };

  const loadOptions = useSearch(slice_type, dataType, dataset_id);

  const { defaultOptions, isLoadingDefaultOptions } = useDefaultOptions(
    slice_type,
    dataType,
    dataset_id
  );

  const invalidValue = useMemo(() => {
    if (!dataset_id || !value || isLoadingDefaultOptions) {
      return false;
    }

    const identifier = getIdentifier(value) as string;

    for (let i = 0; i < defaultOptions.length; i += 1) {
      const opt = defaultOptions[i] as {
        label: string;
        value: string;
        isDisabled: boolean;
      };

      if (identifier === opt.value || identifier === opt.label) {
        if (opt.isDisabled) {
          searchQuery.current = opt.label;
        }

        return opt.isDisabled;
      }
    }

    return true;
  }, [dataset_id, value, isLoadingDefaultOptions, defaultOptions]);

  const label = useLabel(index_type);
  const placeholder = usePlaceholder(slice_type);

  return (
    <AsyncSelect
      label={!swatchColor ? label : null}
      className={selectClassName}
      value={displayValue}
      hasError={invalidValue}
      onChange={(option) =>
        onChange(
          toOutputValue(slice_type, option) as DataExplorerContextV2 | null
        )
      }
      menuWidth={310}
      placeholder={placeholder}
      isLoading={isLoading || isLoadingDefaultOptions}
      loadOptions={loadOptions}
      defaultOptions={defaultOptions}
      formatOptionLabel={formatOptionLabel}
      components={{ MenuList: WindowedMenuList }}
      // cacheOptions={`${slice_type}-${dataType}-${units}-${dataset_id}`}
      cacheOptions={`${slice_type}-${dataType}-${dataset_id}`}
      swatchColor={swatchColor}
      isClearable
      isEditable
      editableInputValue={searchQuery.current}
      onEditInputValue={(editedText) => {
        searchQuery.current = editedText;
      }}
    />
  );
}

export default SearchIndexAwareSliceSelect;
