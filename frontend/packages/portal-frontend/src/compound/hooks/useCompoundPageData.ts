import { useState, useEffect, useMemo } from "react";
import {
  getCorrelationAnalysisOptions,
  getHeatmapDoseCurveOptions,
  getSensitivityTabSummary,
} from "@depmap/api/src/legacyPortalAPI/resources/compound";
import {
  doContextExpDatasetsExistWithCompound,
  getCachedAvailableCompoundDatasetIds,
} from "../utils";
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

        const [
          ids,
          summary,
          doseAndHeatmapOpts,
          corrOpts,
          hasEnrichedLineages,
        ] = await Promise.all([
          getCachedAvailableCompoundDatasetIds(compoundId),
          getSensitivityTabSummary(compoundId),
          getHeatmapDoseCurveOptions(compoundId, compoundLabel),
          getCorrelationAnalysisOptions(compoundLabel),
          doContextExpDatasetsExistWithCompound(compoundId),
        ]);

        setState({
          datasetIds: ids,
          sensitivitySummary: summary,
          doseCurveOptions: doseAndHeatmapOpts,
          heatmapOptions: doseAndHeatmapOpts,
          correlationAnalysisOptions: corrOpts,
          showEnrichedLineages: hasEnrichedLineages,
          isLoading: false,
          error: null,
        });
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
