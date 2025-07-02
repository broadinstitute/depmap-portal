import { HeatmapFormattedData } from "../types";

export function sortHeatmapByViability(
  heatmapFormattedData: HeatmapFormattedData | null
) {
  if (!heatmapFormattedData) {
    return heatmapFormattedData;
  }
  const { modelIds, x, z } = heatmapFormattedData;
  const means = modelIds.map((_, colIdx) => {
    const values = z
      .map((row) => row[colIdx])
      .filter((v) => v !== null && v !== undefined);
    if (values.length === 0) {
      return Infinity;
    }
    // Ensure all values are numbers to avoid typescript error, fallback to 0 if not
    const numericValues = values.map((v) => (typeof v === "number" ? v : 0));
    const sum = numericValues.reduce((acc, v) => acc + v, 0);
    return sum / numericValues.length;
  });
  const sortedIndices = means
    .map((mean, idx) => ({ mean, idx }))
    .sort((a, b) => a.mean - b.mean)
    .map((obj) => obj.idx);
  return {
    ...heatmapFormattedData,
    modelIds: sortedIndices.map((i) => modelIds[i]),
    x: sortedIndices.map((i) => x[i]),
    z: z.map((row) => sortedIndices.map((i) => row[i])),
  };
}

export function getVisibleSortedModelIdIndices(
  sortedHeatmapFormattedData: HeatmapFormattedData | null,
  selectedModelIds: Set<string>,
  showUnselectedLines: boolean
) {
  if (!sortedHeatmapFormattedData) {
    return [];
  }
  if (!showUnselectedLines && selectedModelIds && selectedModelIds.size > 0) {
    return sortedHeatmapFormattedData.modelIds
      .map((id, idx) => (selectedModelIds.has(id) ? idx : -1))
      .filter((idx) => idx !== -1);
  }
  return sortedHeatmapFormattedData.modelIds.map((_, idx) => idx);
}

export function maskHeatmapData(
  sortedHeatmapFormattedData: HeatmapFormattedData | null,
  visibleSortedModelIdIndices: number[],
  visibleZIndexes: number[]
) {
  if (!sortedHeatmapFormattedData) return sortedHeatmapFormattedData;
  const maskedZ = sortedHeatmapFormattedData.z.map((row, rowIdx) => {
    if (!visibleZIndexes.includes(rowIdx)) {
      return row.map(() => null);
    }
    return row.map((val, colIdx) =>
      visibleSortedModelIdIndices.includes(colIdx) ? val : null
    );
  });
  return {
    ...sortedHeatmapFormattedData,
    z: maskedZ,
  };
}

export function getSelectedColumns(
  maskedHeatmapData: HeatmapFormattedData | null,
  selectedModelIds: Set<string>
) {
  const out = new Set<number>();
  maskedHeatmapData?.modelIds.forEach((id, index) => {
    if (id !== null && selectedModelIds.has(id)) {
      out.add(index);
    }
  });
  return out;
}

export function getSearchOptions(
  maskedHeatmapData: HeatmapFormattedData | null,
  displayNameModelIdMap: Map<string, string>
) {
  return maskedHeatmapData
    ? maskedHeatmapData.modelIds.map((modelId, index) => ({
        label: displayNameModelIdMap.get(modelId) || modelId,
        stringId: modelId,
        value: index,
      }))
    : null;
}

export function getCustomData(maskedHeatmapData: HeatmapFormattedData | null) {
  if (!maskedHeatmapData) {
    return undefined;
  }
  const { x, y, z } = maskedHeatmapData;
  return z.map((row, rowIdx) =>
    row.map((val, colIdx) => {
      if (val === null || val === undefined || Number.isNaN(val)) {
        return "";
      }
      return [
        `Cell line: ${x[colIdx]}`,
        `Dose: ${y[rowIdx]} µM`,
        `Viability: ${val.toFixed(3)}`,
      ].join("<br>");
    })
  );
}
