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
