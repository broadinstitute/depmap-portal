import React, { useMemo } from "react";
import type { SliceQuery } from "@depmap/types";
import BarChart from "./BarChart";

interface Props {
  value: SliceQuery | null;
  data: any;
  uniqueId: string;
}

/**
 * Return true if a log scale is likely appropriate.
 *
 * @param data - numeric array
 * @param opts.minOrders - minimum orders of magnitude spanned to recommend log scale
 * @param opts.ignoreFraction - optional fraction (0–0.5) of extreme values to drop from both ends
 */
export function shouldUseLogScale(
  data: number[],
  opts: { minOrders?: number; ignoreFraction?: number } = {}
): boolean {
  const { minOrders = 3, ignoreFraction = 0 } = opts;

  // Filter strictly positive values (log scale requirement)
  const positives = data.filter((d) => d > 0);
  if (positives.length === 0) return false;

  // Optionally trim extreme outliers (symmetric)
  let filtered = positives;
  if (ignoreFraction > 0) {
    const sorted = [...positives].sort((a, b) => a - b);
    const trim = Math.floor(sorted.length * ignoreFraction);
    filtered = sorted.slice(trim, sorted.length - trim);
  }

  if (filtered.length === 0) return false;

  const min = Math.min(...filtered);
  const max = Math.max(...filtered);

  // Avoid division by numbers extremely close to 0
  if (min <= 0) return false;

  const orders = Math.log10(max / min);
  return orders >= minOrders;
}

function CategoricalDataPreview({ value, data, uniqueId }: Props) {
  const plotData = useMemo(() => {
    if (!value || data.length === 0) {
      return {};
    }

    const countsByValue: Record<string, number> = {};
    const values = data.flatMap((row: any) => row[uniqueId]);

    values.forEach((val: string | undefined) => {
      // TODO: Add an option to show NAs instead of always ignoring them.
      if (val !== undefined) {
        countsByValue[val] = (countsByValue[val] || 0) + 1;
      }
    });

    const entries = Object.entries(countsByValue);

    // Sort descending by count
    entries.sort((a: any, b: any) => b[1] - a[1]);

    const sorted = {
      x: entries.map(([key]) => key),
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      y: entries.map(([_, count]) => count),
    };

    return sorted;
  }, [data, uniqueId, value]);

  const useLogScale = useMemo(() => {
    return shouldUseLogScale((plotData as any).y);
  }, [plotData]);

  return (
    <BarChart
      data={plotData}
      useLogScale={useLogScale}
      xAxisTitle={value?.identifier || ""}
    />
  );
}

export default CategoricalDataPreview;
