export const BAR_THICKNESS = 43;

export const currentReleaseDatasets = [
  "Sequencing_WES_Broad",
  "Sequencing_WGS_Broad",
  "Sequencing_RNA_Broad",
  "CRISPR_Achilles_Broad",
  "Drug_OncRef_Broad",
];

// Defines what is asterisked on the DataAvailability
// plot for the Overview tab.
export const growingDatasets = [
  "Sequencing_WGS_Broad",
  "Sequencing_RNA_Broad",
  "CRISPR_Achilles_Broad",
  "CRISPR_ParalogsScreens",
  "Drug_OncRef_Broad",
];

export const DISEASE_COLORS = [
  "#1f77b4",
  "#ff7f0e",
  "#2ca02c",
  "#d62728",
  "#9467bd",
  "#8c564b",
  "#e377c2",
  "#7f7f7f",
  "#bcbd22",
  "#17becf",
];

export const de2PageHref = window.location.href
  .split("?")[0]
  .replace("data_page", "data_explorer_2");

export const currentReleaseTabHref = window.location.href
  .split("?")[0]
  .concat("?tab=currentRelease");

export const overviewTabHref = window.location.href
  .split("?")[0]
  .concat("?tab=overview");

export const allDataTabHref = window.location.href
  .split("?")[0]
  .concat("?tab=allData");

export const getFileUrl = (urlSuffix: string | null) => {
  if (!urlSuffix) {
    return undefined;
  }

  const fileReleaseParams = urlSuffix.split("?")[1];

  return allDataTabHref.concat("&").concat(fileReleaseParams);
};

export const stripHtmlTags = (htmlStr: string | null) => {
  if (!htmlStr) {
    return "";
  }
  return htmlStr.replace(/(<([^>]+)>)/gi, "");
};
