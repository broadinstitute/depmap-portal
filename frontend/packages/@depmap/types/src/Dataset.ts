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
  dataset_md5: string | null;
  name: string;
  index_type_name: string;
  data_type: string;
  priority: number | null;
  taiga_id: string | null;
  group_id: string;
  group: any;
  is_transient: boolean;
  value_type: string | null;
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
  feature_type: string;
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
    }; // indices and identifer both present and non-null

export type MatrixDatasetDataArgs = {
  features: string[];
  feature_identifier: "id" | "label";
  samples?: string[];
  sample_identifier?: "id";
  aggregate?: {
    aggregate_by: string;
    aggregation: string;
  };
};
