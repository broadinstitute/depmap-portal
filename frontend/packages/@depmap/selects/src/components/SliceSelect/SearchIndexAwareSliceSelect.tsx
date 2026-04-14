import React, { useEffect, useMemo, useRef } from "react";
import VanillaAsyncSelect from "react-select/async";
import { WindowedMenuList } from "react-windowed-select";
import extendReactSelect from "../../utils/extend-react-select";
import { SliceSelection } from "./types";
import { useDefaultOptions, useSearch } from "./hooks";
import formatOptionLabel from "./formatOptionLabel";

const AsyncSelect = extendReactSelect(VanillaAsyncSelect);

interface Props {
  slice_type: string;
  dataset_id: string | null;
  dataType: string | null;
  value: SliceSelection | null;
  onChange: (selection: SliceSelection | null) => void;
  label?: string;
  placeholder?: string;
  isLoading?: boolean;
  swatchColor?: string;
  selectClassName?: string;
  menuPortalTarget?: HTMLElement | null;
}

function SearchIndexAwareSliceSelect({
  slice_type,
  dataType,
  dataset_id,
  value,
  onChange,
  label = "Dimension",
  placeholder = "Select…",
  isLoading = false,
  swatchColor = undefined,
  selectClassName = undefined,
  menuPortalTarget = undefined,
}: Props) {
  const searchQuery = useRef("");

  useEffect(() => {
    searchQuery.current = "";
  }, [slice_type, dataType, dataset_id]);

  const displayValue = !value ? null : { value: value.id, label: value.label };
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

    for (let i = 0; i < defaultOptions.length; i += 1) {
      const opt = defaultOptions[i] as {
        label: string;
        value: string;
        isDisabled: boolean;
      };

      if (value.id === opt.value || value.id === opt.label) {
        if (opt.isDisabled) {
          searchQuery.current = opt.label;
        }

        return opt.isDisabled;
      }
    }

    return true;
  }, [dataset_id, value, isLoadingDefaultOptions, defaultOptions]);

  return (
    <AsyncSelect
      label={!swatchColor ? label : null}
      className={selectClassName}
      value={displayValue}
      hasError={invalidValue}
      menuPortalTarget={menuPortalTarget}
      onChange={(
        option: { value: string; label: string } | null | undefined
      ) => {
        onChange(option ? { id: option.value, label: option.label } : null);
      }}
      menuWidth={310}
      placeholder={placeholder}
      isLoading={isLoading || isLoadingDefaultOptions}
      loadOptions={loadOptions}
      defaultOptions={defaultOptions}
      formatOptionLabel={formatOptionLabel}
      components={{ MenuList: WindowedMenuList }}
      cacheOptions={`${slice_type}-${dataType}-${dataset_id}`}
      swatchColor={swatchColor}
      isClearable
      isEditable
      editableInputValue={searchQuery.current}
      onEditInputValue={(editedText: string) => {
        searchQuery.current = editedText;
      }}
    />
  );
}

export default SearchIndexAwareSliceSelect;
