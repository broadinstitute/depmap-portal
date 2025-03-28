import React, { useEffect, useRef } from "react";
import VanillaAsycSelect from "react-select/async";
import { WindowedMenuList } from "react-windowed-select";
import { DataExplorerContextV2 } from "@depmap/types";
import extendReactSelect from "../../../utils/extend-react-select";
import renderConditionally from "../../../utils/render-conditionally";
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
  slice_type: string;
  dataset_id: string | null;
  value: DataExplorerContextV2 | null;
  onChange: (context: DataExplorerContextV2 | null) => void;
  dataType: string | null;
  //  units: string | null;
  swatchColor?: string;
}

function SliceSelect({
  index_type,
  dataType,
  slice_type,
  dataset_id,
  value,
  onChange,
  swatchColor = undefined,
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

  const label = useLabel(index_type);
  const placeholder = usePlaceholder(slice_type);

  return (
    <AsyncSelect
      label={!swatchColor ? label : null}
      value={displayValue}
      // hasError={Boolean(notFound || error)}
      onChange={(option) => onChange(toOutputValue(slice_type, option))}
      menuWidth={310}
      placeholder={/* notFound || */ placeholder}
      isLoading={isLoadingDefaultOptions}
      loadOptions={loadOptions}
      defaultOptions={defaultOptions}
      formatOptionLabel={formatOptionLabel}
      components={{ MenuList: WindowedMenuList }}
      // cacheOptions={`${slice_type}-${dataType}-${units}-${dataset_id}`}
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

export default renderConditionally(SliceSelect);
