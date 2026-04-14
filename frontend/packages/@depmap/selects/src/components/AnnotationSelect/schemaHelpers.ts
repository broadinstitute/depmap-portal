/* eslint-disable no-continue */
import type { Dataset, TabularDataset } from "@depmap/types";
import type { DimensionTypeDescriptor, TableDescriptor } from "./types";

/**
 * Build a lookup from dimension type name to its descriptor.
 */
export function buildDimTypeMap(
  dimTypes: DimensionTypeDescriptor[]
): Record<string, DimensionTypeDescriptor> {
  const map: Record<string, DimensionTypeDescriptor> = {};
  for (const dt of dimTypes) {
    map[dt.name] = dt;
  }
  return map;
}

/**
 * Build a lookup from dimension type name to the set of tabular datasets
 * (as TableDescriptors) indexed by that type. Matrix datasets are ignored
 * here since FK chain walking only traverses tabular columns.
 */
export function buildTablesByDim(
  datasets: Dataset[]
): Record<string, TableDescriptor[]> {
  const map: Record<string, TableDescriptor[]> = {};

  for (const d of datasets) {
    if (d.format !== "tabular_dataset") continue;

    const td = d as TabularDataset;

    if (!map[td.index_type_name]) {
      map[td.index_type_name] = [];
    }

    map[td.index_type_name].push({
      id: td.id,
      given_id: td.given_id,
      name: td.name,
      columns: td.columns_metadata,
    });
  }

  return map;
}
