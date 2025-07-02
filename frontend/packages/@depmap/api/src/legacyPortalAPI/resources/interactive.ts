import { AddDatasetOneRowArgs } from "@depmap/types";
import { UploadTask, UserUploadArgs } from "@depmap/user-upload";
import { getJson, postMultipart } from "../client";

export function getCustomAnalysisDatasets() {
  return getJson<{ label: string; value: string }[]>(
    "/interactive/api/getCustomAnalysisDatasets"
  );
}

export function getCellLineUrlRoot() {
  return getJson<string>("/interactive/api/cellLineUrlRoot");
}

export function postCustomCsv(config: UserUploadArgs) {
  return postMultipart<UploadTask>("/interactive/api/dataset/add-csv", config);
}

export function postCustomCsvOneRow(config: Readonly<AddDatasetOneRowArgs>) {
  return postMultipart<UploadTask>(
    "/interactive/api/dataset/add-csv-one-row",
    config
  );
}
