import { useEffect, useState } from "react";
import { breadboxAPI } from "@depmap/api";

// Module-level so the cache survives across tiles/renders, not just one
// component instance.
const cache = new Map<string, Promise<string>>();

function fetchDatasetName(datasetId: string): Promise<string> {
  if (!cache.has(datasetId)) {
    cache.set(
      datasetId,
      breadboxAPI
        .getDataset(datasetId)
        .then((dataset) => dataset.name)
        .catch(() => datasetId)
    );
  }

  return cache.get(datasetId) as Promise<string>;
}

export function useDatasetNames(datasetIds: string[]) {
  const key = datasetIds.join(",");
  const [names, setNames] = useState<Record<string, string>>({});

  useEffect(() => {
    let cancelled = false;

    Promise.all(
      datasetIds.map((id) =>
        fetchDatasetName(id).then((name) => [id, name] as const)
      )
    ).then((pairs) => {
      if (!cancelled) {
        setNames(Object.fromEntries(pairs));
      }
    });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return names;
}
