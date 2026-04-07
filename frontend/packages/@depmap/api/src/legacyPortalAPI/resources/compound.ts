import {
  CompoundDoseCurveData,
  CompoundSummaryResponse,
  DataAvailByAUCDatasetMetadataMap,
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

export function getDataAvailabilityMetadata(): Promise<DataAvailByAUCDatasetMetadataMap> {
  return getJson<DataAvailByAUCDatasetMetadataMap>(
    `/api/compound/data_availability_metadata`
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

export function getPredictabilityTileData(
  compoundId: string,
  compoundDatasetIds: string[] = []
): Promise<any> {
  const params = {
    compound_id: compoundId,
    compound_dataset_ids: compoundDatasetIds,
  };

  return getJson<any>(`/api/compound/predictability_tile_data`, params);
}
