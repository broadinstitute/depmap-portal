import { DatasetAssociations, SliceQueryAssociations } from "@depmap/types";
import { postJson } from "../client";

export function fetchAssociations(sliceQuery: SliceQueryAssociations) {
  return postJson<DatasetAssociations>(
    "/temp/associations/query-slice",
    sliceQuery
  );
}
