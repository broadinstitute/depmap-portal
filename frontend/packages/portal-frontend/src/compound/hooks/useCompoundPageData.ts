import { useState, useEffect, useMemo } from "react";
import { getCompoundSummary } from "@depmap/api/src/legacyPortalAPI/resources/compound";
import { getCachedAvailableCompoundDatasetIds } from "../utils";
import { SensitivityTabSummary, DatasetOption } from "@depmap/types";
import { getQueryParams } from "@depmap/utils";

export const useCompoundPageData = (
  compoundId: string,
  compoundLabel: string
) => {
  const [state, setState] = useState({
    datasetIds: [] as string[],
    sensitivitySummary: null as SensitivityTabSummary | null,
    doseCurveOptions: [] as any[],
    heatmapOptions: [] as any[],
    correlationAnalysisOptions: [] as any[],
    showEnrichedLineages: false,
    isLoading: true,
    error: null as Error | null,
  });

  useEffect(() => {
    const fetchAllCompoundData = async () => {
      try {
        setState((s) => ({ ...s, isLoading: true }));
        // Step 1: Get Breadbox IDs first
        const ids = await getCachedAvailableCompoundDatasetIds(compoundId);

        // Step 2: Fetch the consolidated summary in one go
        const summary = await getCompoundSummary(
          compoundId,
          compoundLabel,
          ids
        );

        setState((prev) => ({
          ...prev,
          datasetIds: ids,
          sensitivitySummary: summary.sensitivity_summary,
          doseCurveOptions: summary.heatmap_dose_curve_options,
          heatmapOptions: summary.heatmap_dose_curve_options,
          correlationAnalysisOptions: summary.correlation_analysis_options,
          isLoading: false,
        }));
      } catch (err) {
        setState((s) => ({
          ...s,
          isLoading: false,
          error: Error("Failed to load compound data"),
        }));
      }
    };

    fetchAllCompoundData();
  }, [compoundId, compoundLabel]);

  // calculation for the initial Sensitivity dataset
  const initialSelectedDataset = useMemo(() => {
    const summary = state.sensitivitySummary;
    if (!summary || !summary.summary_options.length) return undefined;

    const query = getQueryParams();
    const options = summary.summary_options;
    let selected: DatasetOption | undefined = options[0];

    if ("dependency" in query) {
      const matched = options.find((o) => o.dataset === query.dependency);
      if (matched) selected = matched;
    }

    return selected;
  }, [state.sensitivitySummary]);

  return {
    ...state,
    initialSelectedDataset,
  };
};
