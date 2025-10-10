import { useEffect, useState } from "react";
import type {
  AnchorScreenMetadata,
  TableRow,
  TableFormattedData,
} from "src/anchorScreenDashboard/types";

function useData() {
  const [error, setError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [data, setData] = useState<TableFormattedData>([]);

  useEffect(() => {
    (async () => {
      try {
        const response = await fetch(
          "../breadbox/datasets/tabular/anchor_experiment_metadata",
          { method: "POST" }
        );

        const rawData = await response.json();
        const formatted: TableFormattedData = [];
        const keys = Object.keys(rawData) as (keyof AnchorScreenMetadata)[];

        Object.keys(rawData.ExperimentID).forEach((index) => {
          const row: Partial<TableRow> = {};

          keys.forEach((key) => {
            row[key] = rawData[key][index];
          });

          formatted.push(row as TableRow);
        });

        setData(formatted);
        setIsLoading(false);
      } catch (e) {
        window.console.error(e);
        setError(true);
        setIsLoading(false);
      }
    })();
  }, []);

  return { error, isLoading, data };
}

export default useData;
