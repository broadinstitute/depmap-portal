import React from "react";
import { DataExplorerContextV2 } from "@depmap/types";
import { SliceSelect } from "@depmap/selects";
import {
  contextToSliceSelection,
  sliceSelectionToContext,
} from "./sliceSelectAdapters";
import useSliceSelectLabels from "./useSliceSelectLabels";
import renderConditionally from "../../../utils/render-conditionally";

interface Props {
  index_type: string | null | undefined;
  slice_type: string | null | undefined;
  dataset_id: string | null;
  value: DataExplorerContextV2 | null;
  onChange: (context: DataExplorerContextV2 | null) => void;
  dataType: string | null;
  // FIXME
  // eslint-disable-next-line
  units: string | null;
  isUnknownDataset?: boolean;
  isLoading?: boolean;
  swatchColor?: string;
  selectClassName?: string;
}

function DimensionSliceSelect({
  index_type,
  dataType,
  slice_type,
  dataset_id,
  value,
  onChange,
  isLoading = false,
  isUnknownDataset = false,
  swatchColor = undefined,
  selectClassName = undefined,
}: Props) {
  const {
    label: sliceLabel,
    placeholder: slicePlaceholder,
  } = useSliceSelectLabels(index_type, slice_type);

  return (
    <SliceSelect
      slice_type={typeof slice_type === "string" ? slice_type : undefined}
      isDatasetSpecificSlice={slice_type !== undefined && slice_type === null}
      isUnknownDataset={isUnknownDataset}
      dataset_id={dataset_id || null}
      dataType={dataType}
      value={contextToSliceSelection(value)}
      onChange={(selection) => {
        onChange(sliceSelectionToContext(selection, slice_type));
      }}
      label={sliceLabel}
      placeholder={slicePlaceholder}
      isLoading={isLoading}
      swatchColor={swatchColor}
      selectClassName={selectClassName}
    />
  );
}

export default renderConditionally(DimensionSliceSelect);
