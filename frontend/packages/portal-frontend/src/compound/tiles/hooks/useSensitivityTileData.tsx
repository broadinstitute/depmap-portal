import { useEffect, useState } from "react";
import { breadboxAPI, cached } from "@depmap/api";

export default function useSensitivityTileData(
  compoundId: string,
  datasetGivenId: string
) {
  const [sliceValues, setSliceValues] = useState<number[] | null>(null);
  const [error, setError] = useState(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  useEffect(() => {
    if (!compoundId || !datasetGivenId) {
      setSliceValues(null);
      setError(false);
      setIsLoading(false);
      return;
    }

    (async () => {
      setIsLoading(true);
      setError(false);
      try {
        const bbapi = breadboxAPI;

        const sliceData = await cached(bbapi).getMatrixDatasetData(
          datasetGivenId,
          {
            features: [compoundId],
            feature_identifier: "id",
          }
        );

        const record: Record<string, any> = sliceData[compoundId] || {};

        const dataList = Object.values(record)
          .map((val) => Number(val))
          .filter((val) => typeof val === "number" && !isNaN(val));

        setSliceValues(dataList);
        setIsLoading(false);
      } catch (e) {
        window.console.error(e);
        setSliceValues(null);
        setError(true);
        setIsLoading(false);
      }
    })();
  }, [compoundId, datasetGivenId]);

  return { sliceValues, error, isLoading };
}
