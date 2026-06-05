import { useMemo } from "react";
import { DataExplorerPlotResponse } from "@depmap/types";

// `formatDimension` flips the half-matrix the API returns into the orientation
// PrototypeCorrelationHeatmap expects (cells in the upper triangle become
// undefined, then the row is reversed).
const formatDimension = (zs: number[], i: number) =>
  zs
    .map((val, j) => (i > j ? undefined : val))
    .map((val, j) => {
      if (val !== null) {
        return val;
      }

      return i === j ? 1 : 0;
    })
    .reverse();

// WORKAROUND: The heatmap breaks the data model. A dimension usually has a
// `values` property that is an array of numbers. The /get_correlation endpoint
// returns an array of arrays of numbers.
const assert2d = (array: unknown) => {
  if (!Array.isArray(array)) {
    throw new Error("not an array");
  }

  if (array.length > 0 && !Array.isArray(array[0])) {
    throw new Error("not a 2D array");
  }

  return array as number[][];
};

export interface CorrelationHeatmapData {
  heatmapData: {
    x: string[];
    y: string[];
    z: (number | undefined)[][];
    z2: (number | undefined)[][] | null;
    zLabel: string;
    z2Label: string;
  } | null;
  xLabels: string[] | null;
  yLabels: string[] | null;
  showWarning: boolean;
}

// Encapsulates the data-prep shared by DataExplorerCorrelationHeatmap and
// EmbeddedCorrelationHeatmap. The DE2 variant gates everything on `!isLoading`
// while the embedded variant always proceeds, so `isLoading` defaults to
// false and embedded callers can omit it.
export default function useCorrelationHeatmapData(
  data: DataExplorerPlotResponse | null,
  isLoading: boolean = false
): CorrelationHeatmapData {
  const heatmapData = useMemo(
    () =>
      data && !isLoading
        ? {
            x: data.index_ids.slice().reverse(),
            y: data.index_ids,
            z: assert2d(data.dimensions.x.values).map(formatDimension),
            z2: data.dimensions.x2
              ? assert2d(data.dimensions.x2.values).map(formatDimension)
              : null,
            zLabel: `${data.dimensions.x.axis_label}<br>${data.dimensions.x.dataset_label}`,
            z2Label: data.dimensions.x2
              ? `${data.dimensions.x2.axis_label}<br>${data.dimensions.x2.dataset_label}`
              : "",
          }
        : null,
    [data, isLoading]
  );

  // Heatmap axis ticks show real labels (cell line names for depmap_model,
  // gene symbols for genes, etc). Identity is carried separately by
  // `heatmapData.x`/`.y` above. No legacy fallback needed — post-patch-1,
  // `index_labels` is always real display labels.
  const xLabels = useMemo(
    () => (data && !isLoading ? data.index_labels.slice().reverse() : null),
    [data, isLoading]
  );

  const yLabels = useMemo(
    () => (data && !isLoading ? data.index_labels : null),
    [data, isLoading]
  );

  const showWarning = data?.dimensions.x?.axis_label === "cannot plot";

  return { heatmapData, xLabels, yLabels, showWarning };
}
