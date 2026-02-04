import { getSensitivityTabSummary } from "@depmap/api/src/legacyPortalAPI/resources/compound";
import { useState, useEffect } from "react";
import { getCachedAvailableCompoundDatasetIds } from "../utils";
import { SensitivityTabSummary } from "@depmap/types";

export const useCompoundPageData = (compoundId: string) => {
  const [data, setData] = useState<{
    datasetIds: string[];
    sensitivitySummary: SensitivityTabSummary | null;
  }>({
    datasetIds: [],
    sensitivitySummary: null,
  });

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const fetchAllData = async () => {
      try {
        setIsLoading(true);

        // Fetch both Breadbox IDs and Sensitivity Summary in parallel
        const [ids, summary] = await Promise.all([
          getCachedAvailableCompoundDatasetIds(compoundId),
          getSensitivityTabSummary(compoundId),
        ]);

        setData({
          datasetIds: ids,
          sensitivitySummary: summary,
        });
        setError(null);
      } catch (err) {
        setError(Error("Failed to fetch compound data"));
      } finally {
        setIsLoading(false);
      }
    };

    fetchAllData();
  }, [compoundId]);

  return { ...data, isLoading, error };
};
