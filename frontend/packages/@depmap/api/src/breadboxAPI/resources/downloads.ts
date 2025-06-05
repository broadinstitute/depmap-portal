import { CeleryTask } from "@depmap/compute";
import {
  ExportDataQuery,
  ExportMergedDataQuery,
  FeatureValidationQuery,
  ValidationResult,
} from "@depmap/data-slicer";
import { postJson } from "../client";

export function exportData(query: ExportDataQuery) {
  return postJson<CeleryTask>("/downloads/custom/", query);
}

export function exportDataForMerge(query: ExportMergedDataQuery) {
  return postJson<CeleryTask>("/downloads/custom_merged/", query);
}

export function validateFeaturesInDataset(query: FeatureValidationQuery) {
  return postJson<ValidationResult>(
    "/downloads/data_slicer/validate_data_slicer_features/",
    query
  );
}
