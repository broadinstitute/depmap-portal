import { CurveParams, CurvePlotPoints } from "@depmap/types";
import { getJson } from "../client";

export function getDoseResponsePoints(
  datasetName: string,
  depmapId: string,
  compoundLabel: string
) {
  return getJson<{
    curve_params: Array<CurveParams>;
    points: Array<CurvePlotPoints>;
  }>(`/compound/dosecurve/${datasetName}/${depmapId}/${compoundLabel}`);
}

export function getDoseResponseTable(datasetName: string, xrefFull: string) {
  return getJson<any>(`/compound/dosetable/${datasetName}/${xrefFull}`);
}
