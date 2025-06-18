import { useMemo } from "react";
import { HeatmapFormattedData, TableFormattedData } from "../types";

function useHeatmapFormattedData(
  tableFormattedData: TableFormattedData,
  doseColumnNames: string[]
) {
  // Extract numeric doses for y axis
  const y = useMemo(
    () =>
      doseColumnNames
        .map((d) => parseFloat(d.split(" ")[0]))
        .filter((n) => !isNaN(n)),
    [doseColumnNames]
  );

  const heatmapFormattedData = useMemo(() => {
    if (
      !tableFormattedData ||
      tableFormattedData.length === 0 ||
      y.length === 0
    )
      return null;
    const modelIds = tableFormattedData.map((row) => row.modelId);
    const x = tableFormattedData.map((row) => row.cellLine);
    // Build z matrix: rows = doses, cols = models
    const z = y.map((doseNum, rowIdx) => {
      // Find the original string column name for this dose
      const doseStr = doseColumnNames.find(
        (d) => parseFloat(d.split(" ")[0]) === doseNum
      );
      return modelIds.map((_, colIdx) => {
        const row = tableFormattedData[colIdx];
        const val = doseStr ? row[doseStr as keyof typeof row] : undefined;
        return val !== undefined ? val : null;
      });
    });
    return { modelIds, x, y, z } as HeatmapFormattedData;
  }, [tableFormattedData, doseColumnNames, y]);

  const doseMin = useMemo(() => (y.length > 0 ? Math.min(...y) : null), [y]);
  const doseMax = useMemo(() => (y.length > 0 ? Math.max(...y) : null), [y]);

  return {
    heatmapFormattedData,
    doseMin,
    doseMax,
  };
}

export default useHeatmapFormattedData;
