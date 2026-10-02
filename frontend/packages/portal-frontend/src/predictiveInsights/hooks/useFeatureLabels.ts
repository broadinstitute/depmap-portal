import { useEffect, useState } from "react";
import { breadboxAPI } from "@depmap/api";

// PredictiveFeature.feature_label is currently always null from breadbox (see
// breadbox/breadbox/crud/predictive_models.py), so real labels have to be
// looked up from the feature's source dataset instead.
const cache = new Map<string, Promise<Record<string, string>>>();

function fetchFeatureLabels(
  datasetId: string
): Promise<Record<string, string>> {
  if (!cache.has(datasetId)) {
    cache.set(
      datasetId,
      breadboxAPI
        .getDatasetFeatures(datasetId)
        .then((features) =>
          Object.fromEntries(features.map((f) => [f.id, f.label]))
        )
        .catch(() => ({}))
    );
  }

  return cache.get(datasetId) as Promise<Record<string, string>>;
}

// Returns a map keyed by `${datasetId}:${givenId}` -> label.
export function useFeatureLabels(datasetIds: string[]) {
  const key = datasetIds.join(",");
  const [labels, setLabels] = useState<Record<string, string>>({});

  useEffect(() => {
    let cancelled = false;

    Promise.all(
      datasetIds.map((datasetId) =>
        fetchFeatureLabels(datasetId).then((byGivenId) => ({
          datasetId,
          byGivenId,
        }))
      )
    ).then((results) => {
      if (cancelled) {
        return;
      }

      const combined: Record<string, string> = {};
      results.forEach(({ datasetId, byGivenId }) => {
        Object.entries(byGivenId).forEach(([givenId, label]) => {
          combined[`${datasetId}:${givenId}`] = label;
        });
      });

      setLabels(combined);
    });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return labels;
}
