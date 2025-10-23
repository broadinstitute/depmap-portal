import { ColumnMetadata } from "./Metadata";

export interface MatrixDatasetParams {
  name: string;
  file_ids: string[];
  dataset_md5: Int32Array;
  data_type: string;
  group_id: string;
  priority: number | null;
  taiga_id: string | null;
  is_transient: boolean;
  dataset_metadata?: { [key: string]: string } | null;
  format: "matrix";
  units: string;
  feature_type: string;
  sample_type: string;
  value_type: string | null;
  allowed_values: string[] | null;
}

export interface TableDatasetParams {
  name: string;
  file_ids: string[];
  dataset_md5: Int32Array;
  data_type: string;
  group_id: string;
  priority: number | null;
  taiga_id: string | null;
  is_transient: boolean;
  dataset_metadata?: { [key: string]: string } | null;
  format: "table";
  index_type: string;
  columns_metadata: { [key: string]: any };
}

export type DatasetParams = TableDatasetParams | MatrixDatasetParams;

export interface MatrixDataset {
  id: string;
  format: "matrix_dataset";
  description: string | null;
  dataset_md5: string | null;
  name: string;
  units: string;
  feature_type_name: string;
  sample_type_name: string;
  data_type: string;
  priority: number | null;
  taiga_id: string | null;
  group_id: string;
  group: any;
  is_transient: boolean;
  value_type: string | null;
  allowed_values: string[] | null;
  dataset_metadata: { [key: string]: string } | null;
  given_id: string | null;
}

export interface TabularDataset {
  id: string;
  format: "tabular_dataset";
  description: string | null;
  dataset_md5: string | null;
  name: string;
  index_type_name: string;
  data_type: string;
  priority: number | null;
  taiga_id: string | null;
  group_id: string;
  group: any;
  is_transient: boolean;
  columns_metadata: { [key: string]: ColumnMetadata };
  dataset_metadata: { [key: string]: string } | null;
  given_id: string | null;
}

export type Dataset = TabularDataset | MatrixDataset;

export interface DatasetUpdateArgs {
  [key: string]: any;
  group_id?: any;
  name?: string;
  data_type?: string | null;
  priority?: number | null;
  units?: string;
  dataset_metadata?: { [key: string]: string } | null;
}

export interface AddCustDatasetArgs {
  name: string;
  units: string;
  data_type: string;
  feature_type: string | null;
  sample_type: string;
  value_type: DatasetValueType;
  data_file: any;
  is_transient: boolean;
}

export enum DatasetValueType {
  continuous = "continuous",
  categorical = "categorical",
}

export interface DatasetTableData {
  id: string;
  name: string;
  groupName: string;
  featureType: string | null;
  sampleType: string | null;
  dataType: string | null;
}

// all of the properties are optional, however if indices is provided then identifier must also be provided
export type TabularDatasetDataArgs =
  | { indices?: null; identifier?: null; columns?: string[] | null } // indices and identifer both missing or null
  | {
      indices: string[];
      identifier: "id" | "label";
      columns?: string[] | null;
    }
  | {
      indices?: null;
      identifier?: "id" | "label";
      columns?: string[] | null;
    }; // indice; // indices and identifer both present and non-null

export interface DatasetAssociations {
  dataset_name: string;
  dataset_given_id: string;
  dimension_label: string;
  associated_datasets: {
    name: string;
    dimension_type: string;
    dataset_id: string;
    dataset_given_id: string;
  }[];
  associated_dimensions: AssociatedFeatures[];
}

export interface AssociatedFeatures {
  correlation: number;
  log10qvalue: number;
  other_dataset_id: string;
  other_dataset_given_id: string;
  other_dimension_given_id: string;
  other_dimension_label: string;
}
