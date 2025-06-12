import { DoseTableRow } from "./types";

export function getDoseCurveTableColumns(doseTable: DoseTableRow[]) {
  if (!doseTable || doseTable.length === 0) return [];
  const allCols = Object.keys(doseTable[0]);
  const doseColRegex = /^\d*\.?\d+\s+\S+$/;
  const doseCols = allCols.filter(
    (col) => col !== "modelId" && col !== "AUC" && doseColRegex.test(col)
  );
  const sortedDoseCols = doseCols.sort((a, b) => {
    const aVal = parseFloat(a.split(" ")[0]);
    const bVal = parseFloat(b.split(" ")[0]);
    return aVal - bVal;
  });
  const otherCols = allCols.filter(
    (col) => col !== "modelId" && col !== "AUC" && !doseColRegex.test(col)
  );
  // Build columns array, but leave Cell Line column to be injected by caller
  const orderedCols = ["modelId", "AUC", ...sortedDoseCols, ...otherCols];
  return orderedCols.map((colName: string) => ({
    accessor: colName,
    Header: colName,
    maxWidth: 150,
    minWidth: 100,
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
