import React, { useCallback } from "react";
import VanillaAsycSelect from "react-select/async";
import { WindowedMenuList } from "react-windowed-select";
import { DataExplorerContextV2 } from "@depmap/types";
import extendReactSelect from "../../../utils/extend-react-select";
import renderConditionally from "../../../utils/render-conditionally";
import {
  getIdentifier,
  toOutputValue,
  useDefaultOptions,
  useLabel,
  usePlaceholder,
  useSearch,
} from "./utils";

const AsyncSelect = extendReactSelect(VanillaAsycSelect);

interface Props {
  index_type: string | null;
  slice_type: string;
  value: DataExplorerContextV2 | null;
  onChange: (context: DataExplorerContextV2 | null) => void;
  //  dataType: string | null;
  //  dataset_id: string | null;
  //  units: string | null;
  //  swatchColor?: string;
}

function SliceSelect({ index_type, slice_type, value, onChange }: Props) {
  const search = useSearch();

  const displayValue = !value
    ? null
    : { value: getIdentifier(value) as string, label: value.name };

  const { defaultOptions, isLoadingDefaultOptions } = useDefaultOptions(
    slice_type
  );

  const placeholder = usePlaceholder(slice_type);

  const loadOptions = useCallback(
    async (inputValue: string) => {
      const results = await search(inputValue, slice_type);

      return (
        results
          // FIXME: Only searching on labels for now
          .filter(
            ({ matching_properties }) =>
              matching_properties[0].property === "label"
          )
          .map(({ id, label }) => ({ value: id, label }))
      );
    },
    [search, slice_type]
  );

  return (
    <AsyncSelect
      label={useLabel(index_type)}
      value={displayValue}
      // hasError={Boolean(notFound || error)}
      onChange={(option) => onChange(toOutputValue(slice_type, option))}
      menuWidth={310}
      placeholder={/* notFound || */ placeholder}
      isLoading={isLoadingDefaultOptions}
      loadOptions={loadOptions}
      defaultOptions={defaultOptions}
      // formatOptionLabel={formatOptionLabel}
      components={{ MenuList: WindowedMenuList }}
      // cacheOptions={`${slice_type}-${dataType}-${units}-${dataset_id}`}
      // swatchColor={swatchColor}
      isClearable
      // isEditable
      // editableInputValue={searchQuery.current}
      // onEditInputValue={(editedText) => {
      //   searchQuery.current = editedText;
      // }}
    />
  );
}

export default renderConditionally(SliceSelect);
