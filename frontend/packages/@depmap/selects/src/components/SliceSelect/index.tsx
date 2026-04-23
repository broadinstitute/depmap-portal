import React from "react";
import { SliceSelectProps } from "./types";
import FallbackSliceSelect from "./FallbackSliceSelect";
import DatasetSpecificSliceSelect from "./DatasetSpecificSliceSelect";
import SearchIndexAwareSliceSelect from "./SearchIndexAwareSliceSelect";

function SliceSelect({
  slice_type,
  value,
  onChange,
  swatchColor,
  selectClassName,
  isDatasetSpecificSlice = false,
  isUnknownDataset = false,
  dataset_id = null,
  dataType = null,
  label = "Dimension",
  placeholder = "Select…",
  isLoading = false,
  menuPortalTarget = undefined,
}: SliceSelectProps) {
  if (isUnknownDataset) {
    return (
      <FallbackSliceSelect
        label={label}
        value={value}
        onChange={onChange}
        selectClassName={selectClassName}
        menuPortalTarget={menuPortalTarget}
      />
    );
  }

  if (!slice_type && !isDatasetSpecificSlice) {
    return null;
  }

  if (isDatasetSpecificSlice) {
    return (
      <DatasetSpecificSliceSelect
        label={label}
        placeholder={placeholder}
        dataset_id={dataset_id}
        value={value}
        onChange={onChange}
        selectClassName={selectClassName}
        menuPortalTarget={menuPortalTarget}
      />
    );
  }

  return (
    <SearchIndexAwareSliceSelect
      slice_type={slice_type as string}
      dataType={dataType}
      dataset_id={dataset_id}
      value={value}
      onChange={onChange}
      label={label}
      placeholder={placeholder}
      isLoading={isLoading}
      swatchColor={swatchColor}
      selectClassName={selectClassName}
      menuPortalTarget={menuPortalTarget}
    />
  );
}

export default SliceSelect;
