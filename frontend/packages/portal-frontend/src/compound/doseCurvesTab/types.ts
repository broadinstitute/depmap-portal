import { CurveParams } from "../components/DoseResponseCurve";

export interface CompoundDoseCurveData {
  curve_params: CurveParams[];
  min_dose: number;
  max_dose: number;
  dataset_units: string;
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
  type?: "curve" | "scatter" | null;
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
  viability_dataset_id: string;
  replicate_dataset: string;
  auc_dataset_id: string;
  ic50_dataset_id?: string;
  drc_dataset_label: string;
}
