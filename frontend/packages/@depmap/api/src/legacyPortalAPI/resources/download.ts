import { CeleryTask } from "@depmap/compute";
import {
  DatasetDownloadMetadata,
  ExportDataQuery,
  ExportMergedDataQuery,
  ExportMutationTableQuery,
  FeatureValidationQuery,
  ValidationResult,
} from "@depmap/data-slicer";
import { getJson, postJson } from "../client";

export function getDatasetsDownloadMetadata() {
  return getJson<DatasetDownloadMetadata[]>("/api/download/datasets");
}

export function exportData(query: ExportDataQuery) {
  return postJson<CeleryTask>("/api/download/custom", query);
}

export function exportDataForMerge(query: ExportMergedDataQuery) {
  return postJson<CeleryTask>("/api/download/custom_merged", query);
}

export function validateFeaturesInDataset(query: FeatureValidationQuery) {
  return postJson<ValidationResult>(
    "/download/data_slicer/validate_features",
    query
  );
}

export function getCitationUrl(datasetId: string) {
  return getJson<string>("/download/citationUrl", { dataset_id: datasetId });
}
export function getMutationTableCitation() {
  return getJson<string>(`/api/download/mutation_table_citation`);
}

export function exportMutationTable(
  query: ExportMutationTableQuery
): Promise<any> {
  return postJson<any>("/api/download/custom_mutation_table", query);
}
