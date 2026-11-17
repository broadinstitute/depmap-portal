import { useEffect, useState } from "react";
import { breadboxAPI } from "@depmap/api";

export const NORMS_FLAT_TABLE_ID = "daintree-feature-importance-norms";

export const normKey = (screenName: string, modelName: string) =>
  `${screenName.toLowerCase()}:${modelName.toLowerCase()}`;

// Resolves to a lookup of "screen:model" (lowercased) -> normalization factor.
let cache: Promise<Record<string, number>> | null = null;

function fetchNorms() {
  if (!cache) {
    cache = breadboxAPI
      .getFlatTableSubset(NORMS_FLAT_TABLE_ID, [
        "screen_name",
        "model_name",
        "norm",
      ])
      .then((response) => {
        const col = (name: string) =>
          response.columns.find((c) => c.metadata.given_id === name)!.values;
        const screens = col("screen_name");
        const models = col("model_name");
        const norms = col("norm");
        const result: Record<string, number> = {};
        screens.forEach((screen, i) => {
          result[normKey(String(screen), String(models[i]))] = Number(norms[i]);
        });
        return result;
      })
      .catch((e) => {
        cache = null;
        throw e;
      });
  }

  return cache;
}

export function useFeatureImportanceNorms() {
  const [norms, setNorms] = useState<Record<string, number> | null>(null);
  const [error, setError] = useState<unknown>(null);

  useEffect(() => {
    let cancelled = false;
    fetchNorms()
      .then((n) => !cancelled && setNorms(n))
      .catch((e) => !cancelled && setError(e));

    return () => {
      cancelled = true;
    };
  }, []);

  return { norms, error };
}
