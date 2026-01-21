import { isValidSliceQuery } from "@depmap/types";
import { AnalysisConfiguration } from "../types/AnalysisConfiguration";

function isCompleteAnalysisConfig(
  analysis: Partial<AnalysisConfiguration>
): analysis is AnalysisConfiguration {
  const { index_type, kind, dataSource, datasetId } = analysis;

  if (!index_type || !kind || !dataSource || !datasetId) {
    return false;
  }

  if (kind === "pearson_correlation") {
    const { sliceSource, sliceQuery, unfiltered, filterByContext } = analysis;

    if (!sliceSource || !isValidSliceQuery(sliceQuery)) {
      return false;
    }

    if (!unfiltered && !filterByContext) {
      return false;
    }
  }

  if (kind === "two_class_comparison") {
    const { inGroupContext, useAllOthers, outGroupContext } = analysis;
    if (!inGroupContext) {
      return false;
    }

    if (!useAllOthers && !outGroupContext) {
      return false;
    }
  }

  return true;
}

export default isCompleteAnalysisConfig;
