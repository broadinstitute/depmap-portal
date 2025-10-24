import {
  DatasetAssociations,
  DataExplorerContextV2,
  SliceQuery,
} from "@depmap/types";
import { postJson } from "../client";

export function fetchAssociations(
  sliceQuery: SliceQuery,
  associatedDatasetIds?: string[]
) {
  return postJson<DatasetAssociations>("/temp/associations/query-slice", {
    slice_query: sliceQuery,
    association_datasets: associatedDatasetIds,
  });
}

export async function evaluateContext(
  context: Omit<DataExplorerContextV2, "name">
) {
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

  const contextToEval = {
    ...context,
    vars: varsAsSliceQueries,
  };

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
