import { getSensitivityTabSummary } from "@depmap/api/src/legacyPortalAPI/resources/compound";
import { useState, useEffect, useMemo } from "react";
import { getCachedAvailableCompoundDatasetIds } from "../utils";
import { SensitivityTabSummary, DatasetOption } from "@depmap/types";
import { getQueryParams } from "@depmap/utils";

export const useEntitySummaryData = (compoundId: string) => {
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

  const initialSelectedDataset = useMemo(() => {
    const summary = data.sensitivitySummary;
    if (!summary || !summary.summary_options.length) {
      return undefined;
    }

    const query = getQueryParams();
    const options = summary.summary_options;

    // Default to the first option
    let selected: DatasetOption | undefined = options[0];

    // If 'dependency' is in the URL, try to find a matching dataset
    if ("dependency" in query) {
      const matched = options.find((o) => o.dataset === query.dependency);
      if (matched) {
        selected = matched;
      }
    }

    return selected;
  }, [data.sensitivitySummary]);

  return {
    ...data,
    initialSelectedDataset,
    isLoading,
    error,
  };
};
