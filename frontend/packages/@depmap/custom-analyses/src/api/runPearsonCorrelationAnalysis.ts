import { breadboxAPI, cached } from "@depmap/api";
import { DataExplorerContextV2, SliceQuery } from "@depmap/types";

interface Parameters {
  datasetId: string;
  sliceQuery: SliceQuery;
  filterByContext?: DataExplorerContextV2;
}

async function runPearsonCorrelationAnalysis({
  datasetId,
  sliceQuery,
  filterByContext,
}: Parameters) {
  let queryCellLines: string[] | null = null;

  if (filterByContext) {
    const result = await cached(breadboxAPI).evaluateContext(filterByContext);
    queryCellLines = result.ids;
  }

  if (sliceQuery.identifier_type !== "feature_id") {
    window.console.log("Bad slice query:", sliceQuery);
    throw new Error("Legacy API only supports querying by feature ID.");
  }

  const legacyParams = {
    analysisType: "pearson" as const,
    datasetId,
    queryCellLines,
    queryDatasetId: sliceQuery.dataset_id,
    queryFeatureId: sliceQuery.identifier,
  };

  const task = await breadboxAPI.computeUnivariateAssociations(legacyParams);

  if (task.state !== "PENDING" && task.state !== "PROGRESS") {
    throw new Error("Failed to run task");
  }

  return task;
}

export default runPearsonCorrelationAnalysis;
