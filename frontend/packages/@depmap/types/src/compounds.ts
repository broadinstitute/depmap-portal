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
  dose_curve_metadata: any[];
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
