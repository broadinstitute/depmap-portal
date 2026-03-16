export interface CurveParams {
  ec50: number;
  slope: number;
  lowerAsymptote: number;
  upperAsymptote: number;
  displayName?: string;
  id?: string;
}

export interface DoseCurveData {
  in_group_curve_params: CurveParams[];
  out_group_curve_params: CurveParams[];
  min_dose: number;
  max_dose: number;
}

export interface CurvePlotPoints {
  dose: number;
  viability: number;
  isMasked: boolean;
  replicate: number;
  id?: string;
}

export interface CompoundDoseCurveData {
  dose_replicate_points: {
    [model_id: string]: CurvePlotPoints[];
  };
  curve_params: CurveParams[];
}

export interface CurveTrace {
  x: number[];
  y: number[];
  text?: string[];
  hoverinfo?: string;
  hovertemplate?: string;
  customdata?: string[];
  label?: string[];
  replicate?: string[];
  name: string;
  marker?: any;
  type?: "curve" | "scatter" | "scattergl" | null;
  fill?: "tonextx" | "tozerox" | "none" | null;
  fillcolor?: string;
  opacity?: string;
  line?: any;
  mode?: string;
  id?: string;
}

export type DoseTableRow = {
  modelId: string;
  cell_line_display_name: string;
} & {
  [dose: string]: number;
};

export interface DRCDatasetOptions {
  display_name: string;
  auc_dataset_priority: number | null;
  auc_dataset_display_name: string; // for label on heatmap tile
  viability_dataset_display_name: string; // for label on heatmap tile
  viability_dataset_given_id: string;
  replicate_dataset: string;
  auc_dataset_given_id: string;
  drc_dataset_label: string;
  log_auc_dataset_given_id?: string;
}

export type DatasetOption = {
  dataset: string;
  entity: number;
  id: string;
  label: string;
};

export interface SensitivityTabSummary {
  initialSelectedDataset: DatasetOption;
  size_biom_enum_name: string;
  color: string;
  figure: { name: number };
  show_auc_message: boolean;
  summary_options: DatasetOption[];
}

export interface CompoundSummaryResponse {
  sensitivity_summary: SensitivityTabSummary | null;
  heatmap_dose_curve_options: DRCDatasetOptions[];
  correlation_analysis_options: DRCDatasetOptions[];
}

/**
 * Represents the importance of an individual feature within a predictive model.
 */
export interface PredictabilityFeature {
  name: string;
  importance: number; // 0 to 1
  correlation: number | null; // Pearson correlation coefficient
  type: string; // e.g., 'Target', 'Expression', 'Mutation'
  related_type?: string; // Used for the icon filename
  interactive_url?: string;
}

export interface TopModel {
  model_pearson: number;
  feature_name: string;
  feature_type: string;
  model_label: string;
}

export interface PredictabilityPlotData {
  label: string;
  type: string;
  color: string;
  query_value: number;
  percentile: string;
  background_values: number[];
}

export interface PredictabilityTable {
  type: string;
  dataset: string; // Display name
  dataset_given_id?: string;
  top_models: TopModel[];
}

export interface PredictabilityTileData {
  plot_data: PredictabilityPlotData[];
  overall_top_model: {
    type: string;
    features: PredictabilityFeature[];
  };
  tables: PredictabilityTable[];
}
