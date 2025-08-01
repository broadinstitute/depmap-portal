import {
  CompoundDoseCurveData,
  CurveParams,
  CurvePlotPoints,
  DRCDatasetOptions,
} from "@depmap/types";
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

export function getCompoundDoseCurveData(
  compoundId: string,
  drcDatasetLabel: string,
  replicateDatasetName: string
): Promise<CompoundDoseCurveData> {
  const params = {
    compound_id: compoundId,
    drc_dataset_label: drcDatasetLabel,
    replicate_dataset_name: replicateDatasetName,
  };

  return getJson<CompoundDoseCurveData>(
    `/api/compound/dose_curve_data`,
    params
  );
}

export function getPrioritizedDataset(
  compoundLabel: string
): Promise<DRCDatasetOptions> {
  const params = {
    compound_label: compoundLabel,
  };

  return getJson<DRCDatasetOptions>(
    `/api/compound/prioritized_dataset`,
    params
  );
}
