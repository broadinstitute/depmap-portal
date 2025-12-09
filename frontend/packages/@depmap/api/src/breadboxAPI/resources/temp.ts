import {
  DatasetAssociations,
  DataExplorerContextV2,
  SliceQuery,
} from "@depmap/types";
import { postJson } from "../client";
import { getTabularDatasetData } from "./datasets";
import { getDimensionTypeIdentifiers } from "./types";

export async function fetchAssociations(
  sliceQuery: SliceQuery,
  associatedDatasetIds?: string[]
) {
  const result = await postJson<DatasetAssociations>(
    "/temp/associations/query-slice",
    {
      slice_query: sliceQuery,
      association_datasets: associatedDatasetIds,
    }
  );

  if ("detail" in result) {
    window.console.warn("sliceQuery:", sliceQuery);
    throw new Error(JSON.stringify(result.detail));
  }

  return result;
}

export async function evaluateContext(
  context: Omit<DataExplorerContextV2, "name">
) {
  // Optimization: Try to evaluate trivial expressions using cached data
  // (assuming this function is being called through the `cached()` helper).
  // TODO: There are many more types of expressions we could optimize this way.
  // This is is just a first pass to support the case where someone is editing
  // a long list of feature IDs).
  if (typeof context.expr !== "boolean" && "in" in context.expr) {
    const slice = Object.values(context.vars)[0];

    if (slice.identifier_type === "column") {
      const [colData, identifiers] = await Promise.all([
        getTabularDatasetData(slice.dataset_id, {
          columns: [slice.identifier],
        }),
        getDimensionTypeIdentifiers(context.dimension_type),
      ]);

      const labelMap: Record<string, string> = {};

      for (const { id, label } of identifiers) {
        labelMap[id] = label;
      }

      const valuesToMatch = new Set(context.expr.in[1]);
      const idValuePairs = Object.entries(colData[slice.identifier]);

      const ids = [] as string[];
      const labels = [] as string[];

      for (const [id, value] of idValuePairs) {
        if (valuesToMatch.has(value)) {
          ids.push(id);
          labels.push(labelMap[id]);
        }
      }

      return { ids, labels, num_candidates: idValuePairs.length };
    }
  }

  const varsAsSliceQueries = Object.fromEntries(
    Object.entries(context.vars).map(([varName, variable]) => [
      varName,
      {
        // The `DataExplorerContextVariable` type has some extra fields that
        // aren't part of the SliceQuery format. We'll only include the
        // relevant fields so the backend doesn't get confused.
        dataset_id: variable.dataset_id,
        identifier: variable.identifier,
        identifier_type: variable.identifier_type,
      },
    ])
  );

  const contextToEval = { ...context, vars: varsAsSliceQueries };

  const response = await postJson<
    | {
        ids: string[];
        labels: string[];
        num_candidates: number;
      }
    // WORKAROUND: Errors result in a code 200 like regular responses.
    // We'll look for detail property to detect them.
    // FIXME: Figure out why Breadbox doesn't respond with an error! It's
    // formatted like one.
    | {
        detail: {
          message: string;
          error_type: string;
        };
      }
  >("/temp/context", contextToEval);

  if ("detail" in response) {
    window.console.warn("Could not evaluate context", context);
    throw new Error(JSON.stringify(response.detail, null, 2));
  }

  return response;
}
