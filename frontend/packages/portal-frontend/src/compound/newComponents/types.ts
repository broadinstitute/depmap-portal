import { CurveParams } from "../components/DoseResponseCurve";

export interface CompoundDoseCurveData {
  curve_params: CurveParams[];
  min_dose: number;
  max_dose: number;
}
