import { DatasetParams } from "@depmap/types";
import { postJson } from "../client";

export function postDatasetUpload(datasetParams: DatasetParams) {
  // TODO: Figure out return type.
  return postJson<any>("/dataset-v2/", datasetParams);
}
