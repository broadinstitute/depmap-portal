export interface DimensionType {
  name: string;
  display_name: string;
  id_column: string;
  axis: "feature" | "sample";
  metadata_dataset_id?: string | null;
  properties_to_index?: string[] | null;
}

export interface DimensionTypeWithCounts extends DimensionType {
  datasetsCount: number;
}

export interface FeatureDimensionType extends DimensionType {
  axis: "feature";
}

export interface SampleDimensionType extends DimensionType {
  axis: "sample";
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
