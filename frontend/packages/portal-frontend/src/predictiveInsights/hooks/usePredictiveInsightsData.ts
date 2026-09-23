import { useEffect, useState } from "react";
import { breadboxAPI } from "@depmap/api";
import { ModelConfigOut, PredictiveModelsResponse } from "@depmap/types";

export interface ScreenTypeData {
  actualsDatasetId: string;
  actualsDatasetName: string;
  color: string;
  response: PredictiveModelsResponse;
}

export interface PredictiveInsightsData {
  configs: ModelConfigOut[];
  screenTypes: ScreenTypeData[];
}

// Two distinct, consistent colors are enough for the known CRISPR/RNAi case;
// extra entries only matter if a third screen type ever appears.
const SCREEN_TYPE_COLORS = ["#00b8d9", "#7b61ff", "#ff8a00", "#36b37e"];

export function usePredictiveInsightsData(
  dimType: string,
  dimTypeGivenId: string
) {
  const [data, setData] = useState<PredictiveInsightsData | null>(null);
  const [error, setError] = useState<unknown>(null);

  useEffect(() => {
    let cancelled = false;
    setData(null);
    setError(null);

    (async () => {
      try {
        const [allConfigs, allResults] = await Promise.all([
          breadboxAPI.getPredictiveModelConfigs(),
          breadboxAPI.getPredictiveModelResults(),
        ]);

        const configsForType = allConfigs.find(
          (c) => c.dimension_type_name === dimType
        );
        const configs = configsForType ? configsForType.configs : [];

        const resultsForType = allResults.filter(
          (r) => r.dim_type_name === dimType
        );

        // One "screen type" per distinct actuals dataset, kept in the order
        // it's first encountered.
        const screenTypeOrder: { id: string; name: string }[] = [];
        resultsForType.forEach((r) => {
          if (!screenTypeOrder.some((s) => s.id === r.actuals_dataset_id)) {
            screenTypeOrder.push({
              id: r.actuals_dataset_id,
              name: r.actuals_dataset_name,
            });
          }
        });

        const responses = await Promise.all(
          screenTypeOrder.map((s) =>
            breadboxAPI.getPredictiveModelsForFeature(s.id, dimTypeGivenId)
          )
        );

        if (cancelled) {
          return;
        }

        const screenTypes: ScreenTypeData[] = screenTypeOrder.map((s, i) => ({
          actualsDatasetId: s.id,
          actualsDatasetName: s.name,
          color: SCREEN_TYPE_COLORS[i % SCREEN_TYPE_COLORS.length],
          response: responses[i],
        }));

        setData({ configs, screenTypes });
      } catch (e) {
        if (!cancelled) {
          setError(e);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [dimType, dimTypeGivenId]);

  return { data, error, isLoading: !data && !error };
}
