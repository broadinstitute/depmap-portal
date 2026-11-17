import { postJson } from "../client";

export interface FlatTableSubsetResponse {
  columns: {
    metadata: { given_id: string; name: string; type: string };
    values: (string | number | null)[];
  }[];
  row_count: number;
}

export function getFlatTableSubset(
  flatTableId: string,
  columns?: string[],
  filters: { column: string; values: string[] }[] = []
) {
  return postJson<FlatTableSubsetResponse>("/flattable/subset", {
    flat_table_id: flatTableId,
    filters,
    columns,
  });
}
