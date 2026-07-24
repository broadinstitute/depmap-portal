export const getDatasetLabelFromId = (datasetId: string) => {
  if (datasetId === "Rep_all_single_pt") {
    return "Repurposing";
  }

  if (datasetId === "Prism_oncology_AUC") {
    return "OncRef Lum";
  }

  if (datasetId === "Prism_oncology_seq_AUC") {
    return "OncRef Seq";
  }

  if (datasetId === "Prism_oncology_harmonized_AUC") {
    return "OncRef Harmonized";
  }

  return "Unknown";
};

export const getDatasetIdFromLabel = (datasetLabel: string) => {
  if (datasetLabel === "Repurposing") {
    return "Rep_all_single_pt";
  }

  if (datasetLabel === "OncRef Seq") {
    return "Prism_oncology_seq_AUC";
  }

  if (datasetLabel === "OncRef Lum") {
    return "Prism_oncology_AUC";
  }

  if (datasetLabel === "OncRef Harmonized") {
    return "Prism_oncology_harmonized_AUC";
  }

  return "Unknown";
};

export const COMPOUND_DASHBOARD_DATASET_IDS = [
  "Rep_all_single_pt",
  "Prism_oncology_AUC",
  "Prism_oncology_seq_AUC",
  "Prism_oncology_harmonized_AUC",
];
