import { useEffect, useState } from "react";
import { breadboxAPI } from "@depmap/api";

export interface AssociationsResult {
  label: string[];
  given_id: string[];
  cor: number[];
}

// The "Dataset correlation" scatter and the "Feature rank" plot both need
// every feature in a dataset correlated against the same actuals profile —
// cached module-level (like useFeatureLabels/useDatasetNames) so expanding a
// feature row doesn't issue the same /temp/associations/compute call twice.
const cache = new Map<string, Promise<AssociationsResult>>();

function fetchCorrelationsWithActual(
  featureDatasetId: string,
  actualsDatasetId: string,
  actualsFeatureGivenId: string
): Promise<AssociationsResult> {
  const key = `${featureDatasetId}:${actualsDatasetId}:${actualsFeatureGivenId}`;

  if (!cache.has(key)) {
    cache.set(
      key,
      breadboxAPI.computeAssociations(featureDatasetId, {
        dataset_id: actualsDatasetId,
        identifier: actualsFeatureGivenId,
        identifier_type: "feature_id",
      })
    );
  }

  return cache.get(key) as Promise<AssociationsResult>;
}

export function useCorrelationsWithActual(
  featureDatasetId: string,
  actualsDatasetId: string,
  actualsFeatureGivenId: string
) {
  const [data, setData] = useState<AssociationsResult | null>(null);
  const [error, setError] = useState<unknown>(null);

  useEffect(() => {
    let cancelled = false;
    setData(null);
    setError(null);

    fetchCorrelationsWithActual(
      featureDatasetId,
      actualsDatasetId,
      actualsFeatureGivenId
    )
      .then((result) => {
        if (!cancelled) {
          setData(result);
        }
      })
      .catch((e) => {
        if (!cancelled) {
          setError(e);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [featureDatasetId, actualsDatasetId, actualsFeatureGivenId]);

  return { data, error };
}
