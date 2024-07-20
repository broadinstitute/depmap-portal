export const BAR_THICKNESS = 42;

export const currentReleaseDatasets = [
  "Sequencing_WES_Broad",
  "Sequencing_WGS_Broad",
  "Sequencing_RNA_Broad",
  "CRISPR_Achilles_Broad",
  "Drug_OncRef_Broad",
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
