import React from "react";
import { DataExplorerContextV2 } from "@depmap/types";
import renderConditionally from "../../../utils/render-conditionally";
import {} from "../useDimensionStateManager/types";
import FallbackSliceSelect from "./FallbackSliceSelect";
import DatasetSpecificSliceSelect from "./DatasetSpecificSliceSelect";
import SearchIndexAwareSliceSelect from "./SearchIndexAwareSliceSelect";

interface Props {
  index_type: string | null;
  slice_type: string | null | undefined;
  dataset_id: string | null;
  value: DataExplorerContextV2 | null;
  onChange: (context: DataExplorerContextV2 | null) => void;
  dataType: string | null;
  //  units: string | null;
  isUnknownDataset: boolean;
  isLoading: boolean;
  swatchColor?: string;
}

function SliceSelect({
  index_type,
  dataType,
  slice_type,
  dataset_id,
  value,
  onChange,
  isUnknownDataset,
  isLoading,
  swatchColor = undefined,
}: Props) {
  if (slice_type === undefined) {
    return null;
  }

  if (isUnknownDataset) {
    return (
      <FallbackSliceSelect
        index_type={index_type}
        value={value}
        onChange={onChange}
      />
    );
  }

  if (slice_type === null) {
    return (
      <DatasetSpecificSliceSelect
        dataset_id={dataset_id}
        value={value}
        onChange={onChange}
      />
    );
  }

  return (
    <SearchIndexAwareSliceSelect
      index_type={index_type}
      dataType={dataType}
      slice_type={slice_type}
      dataset_id={dataset_id}
      value={value}
      onChange={onChange}
      isLoading={isLoading}
      swatchColor={swatchColor}
    />
  );
}

export default renderConditionally(SliceSelect);
