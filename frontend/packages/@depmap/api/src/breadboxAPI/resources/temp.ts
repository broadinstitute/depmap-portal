import { DatasetAssociations, SliceQuery } from "@depmap/types";
import { postJson } from "../client";

export function fetchAssociations(
  sliceQuery: SliceQuery,
  associatedDatasetIds?: string[]
) {
  return postJson<DatasetAssociations>("/temp/associations/query-slice", {
    slice_query: sliceQuery,
    association_datasets: associatedDatasetIds,
  });
}
