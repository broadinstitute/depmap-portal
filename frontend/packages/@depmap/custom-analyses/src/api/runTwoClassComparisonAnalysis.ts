import { breadboxAPI, cached } from "@depmap/api";
import { DataExplorerContextV2 } from "@depmap/types";

interface Parameters {
  datasetId: string;
  inGroupContext: DataExplorerContextV2;
  outGroupContext?: DataExplorerContextV2;
}

async function runTwoClassComparisonAnalysis({
  datasetId,
  inGroupContext,
  outGroupContext,
}: Parameters) {
  const inGroupIdentifiers = await cached(breadboxAPI).evaluateContext(
    inGroupContext
  );

  const queryIds = await (async () => {
    if (!outGroupContext) {
      const allIdentifiers = await cached(breadboxAPI).getDatasetSamples(
        datasetId
      );

      return allIdentifiers.map(({ id }) => id);
    }

    const outGroupIdentifiers = outGroupContext
      ? await cached(breadboxAPI).evaluateContext(outGroupContext)
      : { ids: [] };

    return new Set([...inGroupIdentifiers.ids, ...outGroupIdentifiers.ids]);
  })();

  const queryCellLines: string[] = [];
  const queryValues: ("in" | "out")[] = [];
  const inGroup = new Set(inGroupIdentifiers.ids);

  for (const id of queryIds) {
    queryCellLines.push(id);
    queryValues.push(!inGroup.has(id) ? "out" : "in");
  }

  const task = await breadboxAPI.computeUnivariateAssociations({
    analysisType: "two_class" as const,
    vectorVariableType: "independent" as const,
    datasetId,
    queryCellLines,
    queryValues,
  });

  if (task.state !== "PENDING" && task.state !== "PROGRESS") {
    throw new Error("Failed to run task");
  }

  return task;
}

export default runTwoClassComparisonAnalysis;
