import {
  CompoundDoseCurveData,
  DRCDatasetOptions,
  SensitivityTabSummary,
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

export function getSensitivityTabSummary(
  compoundId: string
): Promise<SensitivityTabSummary> {
  const params = {
    compound_id: compoundId,
  };

  return getJson<SensitivityTabSummary>(
    `/api/compound/sensitivity_summary`,
    params
  );
}

export function getHeatmapDoseCurveOptions(
  compoundId: string,
  compoundName: string
): Promise<DRCDatasetOptions[]> {
  const params = {
    compound_id: compoundId,
    compound_label: compoundName,
  };

  return getJson<DRCDatasetOptions[]>(
    `/api/compound/heatmap_dose_curve_options`,
    params
  );
}

export function getCorrelationAnalysisOptions(
  compoundName: string
): Promise<DRCDatasetOptions[]> {
  const params = {
    compound_label: compoundName,
  };

  return getJson<DRCDatasetOptions[]>(
    `/api/compound/correlation_analysis_options`,
    params
  );
}
