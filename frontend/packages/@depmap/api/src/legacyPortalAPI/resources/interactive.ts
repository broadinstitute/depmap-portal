import { getJson } from "../client";

export function getCustomAnalysisDatasets() {
  return getJson<{ label: string; value: string }[]>(
    "/interactive/api/getCustomAnalysisDatasets"
  );
}

export function getCellLineUrlRoot() {
  return getJson<string>("/interactive/api/cellLineUrlRoot");
}
