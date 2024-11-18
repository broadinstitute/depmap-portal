import { DataExplorerContext } from "@depmap/types";

export interface SliceLabelSelectProps {
  slice_type: string;
  value: DataExplorerContext | null;
  onChange: (context: DataExplorerContext | null) => void;
  dataType: string | null;
  dataset_id: string | null;
  units: string | null;
  swatchColor?: string;
  removeWrapperDiv?: boolean;

  // Special case
  onChangeCompound?: (
    context: DataExplorerContext | null,
    dataset_id: string | null
  ) => void;
}
