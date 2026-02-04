import {
  CompoundDoseCurveData,
  CompoundSummaryResponse,
  DRCDatasetOptions,
} from "@depmap/types";
import { getJson } from "../client";

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
  compoundLabel: string,
  compoundId: string
): Promise<DRCDatasetOptions> {
  const params = {
    compound_label: compoundLabel,
    compound_id: compoundId,
  };

  return getJson<DRCDatasetOptions>(
    `/api/compound/prioritized_dataset`,
    params
  );
}

export function getCompoundSummary(
  compoundId: string,
  compoundName: string,
  compoundDatasetIds: string[] = []
): Promise<CompoundSummaryResponse> {
  const params = {
    compound_id: compoundId,
    compound_label: compoundName,
    compound_dataset_ids: compoundDatasetIds,
  };

  return getJson<CompoundSummaryResponse>(
    `/api/compound/compound_summary`,
    params
  );
}
