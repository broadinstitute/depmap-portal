import { useEffect, useState, useMemo } from "react";
import { legacyPortalAPI, cached } from "@depmap/api";

export default function usePredictabilityTileData(
  compoundId: string,
  datasetGivenIds: string[]
) {
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const memoizedIds = useMemo(() => datasetGivenIds, [
    JSON.stringify(datasetGivenIds),
  ]);

  useEffect(() => {
    if (!compoundId || memoizedIds.length === 0) {
      setData(null);
      setError(false);
      setIsLoading(false);
      return;
    }

    const fetchData = async () => {
      setIsLoading(true);
      setError(false);
      try {
        const result = await cached(legacyPortalAPI).getPredictabilityTileData(
          compoundId,
          memoizedIds
        );

        setData(result);
        setIsLoading(false);
      } catch (e) {
        window.console.error(e);
        setError(true);
        setIsLoading(false);
        setData(null);
      }
    };

    fetchData();
  }, [compoundId, memoizedIds]);

  return { data, error, isLoading };
}
