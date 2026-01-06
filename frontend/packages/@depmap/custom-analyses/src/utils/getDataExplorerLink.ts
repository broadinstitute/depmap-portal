import qs from "qs";
import { breadboxAPI, cached } from "@depmap/api";
import { ComputeResponseResult } from "@depmap/compute";
import { persistContext } from "@depmap/data-explorer-2";
import { isElara } from "@depmap/globals";
import { DataExplorerContextV2 } from "@depmap/types";
import {
  AnalysisConfiguration,
  PearsonCorrelationConfiguration,
  TwoClassComparisonConfiguration,
} from "../types/AnalysisConfiguration";

async function getDataExplorerLink(
  analysis: AnalysisConfiguration,
  result: ComputeResponseResult
) {
  const firstFeature = result.data[0].label;
  const baseUrl = isElara ? "../elara" : "../data_explorer_2";
  // Encode the current query string so this analysis can later be reproduced.
  const encodedAnalysis = btoa(window.location.search.slice(1));

  if (analysis.kind === "pearson_correlation") {
    const {
      datasetId,
      filterByContext,
      sliceQuery,
    } = analysis as PearsonCorrelationConfiguration;

    const filter = filterByContext
      ? await persistContext(filterByContext)
      : undefined;

    const features = await cached(breadboxAPI).getDatasetFeatures(
      sliceQuery.dataset_id
    );

    let identifierLabel = "";

    for (const { id, label } of features) {
      if (id === sliceQuery.identifier) {
        identifierLabel = label;
      }
    }

    const queryString = qs.stringify({
      task: result.taskId,
      xFeature: identifierLabel,
      xDataset: sliceQuery.dataset_id,
      yFeature: firstFeature,
      yDataset: datasetId,
      filter,
      analysis: encodedAnalysis,
    });

    return `${baseUrl}/?${queryString}`;
  }

  if (analysis.kind === "two_class_comparison") {
    const {
      datasetId,
      inGroupContext,
      outGroupContext,
    } = analysis as TwoClassComparisonConfiguration;

    const color1 = await persistContext(inGroupContext);
    let color2;
    let filter;

    if (outGroupContext) {
      color2 = await persistContext(outGroupContext);

      const inGroup = await cached(breadboxAPI).evaluateContext(inGroupContext);
      const outGroup = await cached(breadboxAPI).evaluateContext(
        outGroupContext
      );

      if (inGroup.ids.length + outGroup.ids.length < inGroup.num_candidates) {
        const combinedIds = [...new Set([...inGroup.ids, ...outGroup.ids])];

        const combinedContext: DataExplorerContextV2 = {
          dimension_type: inGroupContext.dimension_type,
          name: "in/out groups combined",
          expr: { in: [{ var: "given_id" }, combinedIds] },
          vars: {},
        };

        filter = await persistContext(combinedContext);
      }
    }

    const queryString = qs.stringify({
      task: result.taskId,
      xFeature: firstFeature,
      xDataset: datasetId,
      color1,
      color2,
      filter,
      analysis: encodedAnalysis,
    });

    return `${baseUrl}/?${queryString}`;
  }

  throw new Error(
    `Analysis kind ${(analysis as AnalysisConfiguration).kind} not implemented`
  );
}

export default getDataExplorerLink;
