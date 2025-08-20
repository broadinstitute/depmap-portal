import { CellignerColorsForCellLineSelector } from "@depmap/cell-line-selector";
import { getJson } from "../client";

export function getCellignerDistancesToTumors(
  primarySite: string,
  subtype: string
) {
  return getJson<any>("/celligner/distance_tumors_to_cell_lines", {
    primarySite,
    subtype,
  });
}

export function getCellignerDistancesToCellLine(
  modelConditionId: string,
  kNeighbors: number
) {
  return getJson<{
    distance_to_tumors: Array<number>;
    most_common_lineage: string;
    color_indexes: Array<number>;
  }>(`/celligner/distance_cell_line_to_tumors`, {
    modelConditionId,
    kNeighbors,
  });
}

export function getCellignerColorMap() {
  return getJson<CellignerColorsForCellLineSelector>("/celligner/colors");
}
