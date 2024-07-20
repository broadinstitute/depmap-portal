export interface MatrixDatasetParams {
  name: string;
  file_ids: string[];
  dataset_md5: Int32Array;
  data_type: string;
  group_id: string;
  priority: number | null;
  taiga_id: string | null;
  is_transient: boolean;
  dataset_metadata?: any;
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
  dataset_metadata?: any;
  format: "table";
  units: string;
  index_type: string;
  columns_metadata: { [key: string]: any };
}

export type DatasetParams = TableDatasetParams | MatrixDatasetParams;

export interface Dataset {
  [key: string]: any;
  allowed_values: string[] | null;
  feature_type: string | null;
  data_type: string | null;
  priority: number | null;
  taiga_id: string | null;
  group_id: any;
  id: string;
  is_transient: boolean;
  name: string;
  sample_type: string | null;
  units: string;
  value_type: string | null;
  dataset_metadata?: any;
}

export interface DatasetUpdateArgs {
  [key: string]: any;
  id: string;
  group_id: any;
  name?: string;
  data_type?: string | null;
  priority?: number | null;
  units?: string;
  dataset_metadata?: any;
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
