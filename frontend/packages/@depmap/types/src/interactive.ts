export interface LinRegInfo {
  slope: number;
  intercept: number;
  number_of_points: number;
  pearson: number;
  spearman: number;
  p_value: number;
  group_label: string | null;
}

export interface AddDatasetOneRowArgs {
  units?: string;
  uploadFile?: any;
}

export interface Association {
  other_entity_label: string;
  other_dataset: string;
  other_dataset_name: string;
  correlation: number;
  p_value: number;
  z_score: number;
}

export interface AssociationAndCheckbox {
  data: Array<Association>;
  associatedDatasets: Array<string>;
  datasetLabel: string;
  featureLabel: string;
  checkboxes: { label: string; name: string }[];
}
