// Types mirroring breadbox/breadbox/schemas/predictive_models.py.
// Unrelated to the legacy `predictability.ts` types (different feature).

export interface IDAndName {
  id: string;
  name: string;
}

export interface ModelConfigOut {
  id: string;
  model_config_name: string;
  model_config_description: string;
}

export interface PredictiveModelConfigOut {
  dimension_type_name: string;
  configs: ModelConfigOut[];
}

export interface PredictiveModelResultOut {
  dim_type_name: string;
  config_name: string;
  actuals_dataset_id: string;
  actuals_dataset_name: string;
  actuals_dataset_taiga_id: string | null;
  predictions_dataset_id: string;
  predictions_dataset_name: string;
  predictions_taiga_id: string | null;
  etag: string;
}

export interface PredictiveFeature {
  rank: number;
  feature_dataset_id: string;
  feature_given_id: string;
  feature_label: string | null;
  importance: number;
  correlation_with_actual: number;
}

export interface ModelFit {
  predictions_dataset: IDAndName;
  config_name: string;
  config_description: string;
  prediction_actual_correlation: number;
  top_features: PredictiveFeature[];
}

export interface PredictiveModelsResponse {
  actuals_dataset: IDAndName;
  actuals_feature_given_id: string;
  actuals_feature_label: string;
  model_fits: ModelFit[];
}
