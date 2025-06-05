import { SliceQuery } from "@depmap/types";
import { postJson } from "../client";

export function fetchAssociations(sliceQuery: SliceQuery) {
  return postJson<{
    dataset_name: string;
    dimension_label: string;
    associated_datasets: {
      name: string;
      dimension_type: string;
      dataset_id: string;
    }[];
    associated_dimensions: {
      correlation: number;
      log10qvalue: number;
      other_dataset_id: string;
      other_dimension_given_id: string;
      other_dimension_label: string;
    }[];
  }>("/temp/associations/query-slice", sliceQuery);
}
