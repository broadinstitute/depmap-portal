import { DataExplorerContext } from "@depmap/types";

export interface EntitySelectorProps {
  entity_type: string;
  value: DataExplorerContext | null;
  onChange: (context: DataExplorerContext | null) => void;
  dataType: string | null;
  dataset_id: string | null;
  units: string | null;
  swatchColor?: string;

  // Special case
  onChangeCompound?: (
    context: DataExplorerContext | null,
    dataset_id: string | null
  ) => void;
}