import React, { useMemo } from "react";
import type { SliceQuery } from "@depmap/types";
import BarChart from "./BarChart";

interface Props {
  value: SliceQuery | null;
  data: any;
  uniqueId: string;
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

  return <BarChart data={plotData} xAxisTitle={value?.identifier || ""} />;
}

export default CategoricalDataPreview;
