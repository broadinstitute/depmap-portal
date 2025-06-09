import { DoseTableRow } from "./types";

export function doseCurveTableColumns(doseTable: DoseTableRow[]) {
  if (!doseTable || doseTable.length === 0) return [];
  const allCols = Object.keys(doseTable[0]);
  // Different datasets might have different dose columns (I think), so we can't just
  // hardcode these. But is this reliable enough?...
  // Identify dose columns: match format '<float> <units>'
  const doseColRegex = /^\d*\.?\d+\s+\S+$/;
  const doseCols = allCols.filter(
    (col) => col !== "modelId" && col !== "AUC" && doseColRegex.test(col)
  );
  // Sort dose columns by numeric value
  const sortedDoseCols = doseCols.sort((a, b) => {
    const aVal = parseFloat(a.split(" ")[0]);
    const bVal = parseFloat(b.split(" ")[0]);
    return aVal - bVal;
  });
  // Any other columns (not modelId, AUC, or dose columns)
  const otherCols = allCols.filter(
    (col) => col !== "modelId" && col !== "AUC" && !doseColRegex.test(col)
  );
  const orderedCols = ["modelId", "AUC", ...sortedDoseCols, ...otherCols];
  return orderedCols.map((colName: string) => ({
    accessor: colName,
    Header: colName,
    maxWidth: 150,
    minWidth: 150,
  }));
}

export const sortBySelectedModel = (
  doseTable: DoseTableRow[],
  selectedModelIds: Set<string>
) => {
  return doseTable.sort((a, b) => {
    const aHasPriority = selectedModelIds.has(a.modelId);
    const bHasPriority = selectedModelIds.has(b.modelId);

    if (aHasPriority && !bHasPriority) {
      return -1; // a comes first
    }
    if (!aHasPriority && bHasPriority) {
      return 1; // b comes first
    }
    // If both or neither have a selectedModelId, it doesn't matter which comes first
    return -1;
  });
};
