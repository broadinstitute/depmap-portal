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
}
