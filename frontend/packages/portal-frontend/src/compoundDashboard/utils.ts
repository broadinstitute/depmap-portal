export const getDatasetLabelFromId = (datasetId: string) => {
  if (datasetId === "Rep_all_single_pt") {
    return "Repurposing";
  }

  if (datasetId === "Prism_oncology_AUC") {
    return "OncRef";
  }

  return "Unknown";
};

export const getDatasetIdFromLabel = (datasetLabel: string) => {
  if (datasetLabel === "Repurposing") {
    return "Rep_all_single_pt";
  }

  if (datasetLabel === "OncRef") {
    return "Prism_oncology_AUC";
  }

  return "Unknown";
};

export const COMPOUND_DASHBOARD_DATASET_IDS = [
  "Rep_all_single_pt",
  "Prism_oncology_AUC",
];
