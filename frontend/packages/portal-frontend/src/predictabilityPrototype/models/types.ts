export enum ModelName {
  CellContext = "CellContext",
  DriverEvents = "DriverEvents",
  GeneticDerangement = "GeneticDerangement",
  DNA = "DNA",
  RNASeq = "RNASeq",
}

export const FEATURE_SET_COLORS = new Map<string, string>([
  [ModelName.CellContext, "#3F3F9F"],
  [ModelName.DriverEvents, "#c55252"],
  [ModelName.GeneticDerangement, "#E1790E"],
  [ModelName.DNA, "#86BDB5"],
  [ModelName.RNASeq, "#2FA9D0"],
]);

export type TopFeaturesBarData = {
  data: {
    feature: string[];
    adj_feature_importance: number[];
    feature_type: string[];
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
  featureSummary: FeatureSummary;
  relatedFeaturePlot: RelatedFeaturePlot;
  waterfallPlot: RelatedFeaturePlot;
};

export type FeatureSummary = {
  actuals_slice: number[];
  feature_name: string;
  feature_type: string;
  feature_importance: number;
  pearson: number;
};

export type FeatureSummaries = {
  [key: string]: FeatureSummary;
};

export type RelatedFeaturePlot = {
  x: number[];
  y: number[];
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
  r: number;
  feature_summaries: FeatureSummaries;
};

export type AggScoresData = {
  accuracies: {
    name: string[];
    accuracy: number[];
    feature_highest_importance: { [key: string]: string };
  };
  x_axis_label: string;
  y_axis_label: string;
};

export type ModelPerformanceData = {
  [key: string]: PredictiveModelData;
};

export type PredictabilityData = {
  overview: {
    aggregated_scores: AggScoresData;
    top_features: TopFeaturesBarData;
    gene_tea_symbols: string[];
  };
  // Per predictive model
  model_performance_data: ModelPerformanceData;
};
