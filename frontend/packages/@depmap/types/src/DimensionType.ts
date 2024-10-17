export interface DimensionType {
  name: string;
  display_name: string;
  id_column: string;
  axis: "feature" | "sample";
  metadata_dataset_id?: string | null;
  properties_to_index?: string[] | null;
}

export interface DimensionTypeAddArgs {
  name: string;
  display_name: string;
  id_column: string;
  axis: "feature" | "sample";
}

export interface DimensionTypeUpdateArgs {
  display_name?: string;
  metadata_dataset_id?: string | null;
  properties_to_index?: string[] | null;
}
