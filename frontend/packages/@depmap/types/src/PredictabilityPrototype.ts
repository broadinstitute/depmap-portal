import { RelatedType } from "@depmap/types/src/predictability";

export type TopFeaturesBarData = {
  data: {
    feature: string[];
    adj_feature_importance: number[];
    dim_type: string[];
    feature_set: string[];
    model_name: string[];
  };
  x_axis_label: string;
  y_axis_label: string;
};

export type ModelPredictionsGraphData = {
  model_pred_data: {
    predictions: number[];
    actuals: number[];
  };
  predictions_dataset_id: string;
  index_labels: string[];
  x_label: string;
  y_label: string;
  model: string;
  density: any;
};

export type CorrData = {
  corr_heatmap_vals: number[][];
  row_labels: string[];
  gene_symbol_feature_types: { [key: string]: string };
  feature_names: string[];
  feature_types: string[];
};

export type FeatureVsGeneEffectPlotData = {
  actuals_slice: number[];
  feature_dataset_id: string;
  feature_actuals_values: number[];
  feature_actuals_value_labels: string[];
  density: number[];
  x_axis_label: string;
  y_axis_label: string;
};

export type FeatureInfo = {
  featureSummary: FeatureInfoSummary;
  relatedFeaturePlot: RelatedFeaturePlot;
  waterfallPlot: RelatedFeaturePlot;
};

// TODO: Fix FeatureInfoSummary and FeatureSummary to more clearly
// differentiate between the 2. 1 is used for the feature headers
// on initial load, and 1 is used afterwards for loading of ALL the
// individual feature's data. There names are too similar at the moment...
export type FeatureInfoSummary = {
  actuals_slice: number[];
  feature_name: string;
  feature_type_label: string;
  dim_type: string;
  feature_importance: number;
  pearson: number;
};

export type FeatureSummary = {
  feature_label: string;
  feature_type: string;
  dim_type: string;
  feature_importance: number;
  related_type: RelatedType | null;
  pearson: number;
};

export type FeatureSummaries = {
  [key: string]: FeatureSummary;
};

export type RelatedFeaturePlot = {
  x: number[];
  x_index?: string[];
  y: number[];
  y_index?: string[];
  density?: number[];
  x_label: string;
  y_label: string;
};

export type RelatedFeaturesScatterPlots = {
  [key: string]: RelatedFeaturePlot;
};

export type FeatureWaterfallPlots = {
  [key: string]: RelatedFeaturePlot;
};

export type PredictiveModelData = {
  model_predictions: ModelPredictionsGraphData;
  corr: CorrData;
};

export type AggScoresData = {
  accuracies: {
    name: string[];
    accuracy: number[];
    feature_highest_importance: { [key: string]: string[] };
  };
  x_axis_label: string;
  y_axis_label: string;
};

export type ModelPerformanceInfo = {
  r: number;
  feature_summaries: FeatureSummaries;
};

export interface GeneTeaSearchTerm {
  name: string;
  feature_type_label: string;
  importance_rank: number;
}

export interface PredData {
  [screen_type: string]: {
    overview: {
      aggregated_scores: AggScoresData;
      top_features: TopFeaturesBarData;
      gene_tea_symbols: GeneTeaSearchTerm[];
    };
    // Per predictive model
    model_performance_info: { [key: string]: ModelPerformanceInfo };
  };
}

export interface PredictabilityData {
  data: PredData;
  error_message?: string;
}

export interface PredictabilityBoxOrBarPlot {
  data: number[] | { fraction_0: number; fraction_1: number };
  is_binary: boolean;
}
