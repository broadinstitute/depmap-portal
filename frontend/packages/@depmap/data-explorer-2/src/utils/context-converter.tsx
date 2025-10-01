import React from "react";
import { cached, breadboxAPI } from "@depmap/api";
import { showInfoModal } from "@depmap/common-components";
import {
  DataExplorerContext,
  DataExplorerContextV2,
  DataExplorerContextVariable,
} from "@depmap/types";
import wellKnownDatasets from "../constants/wellKnownDatasets";
import { sliceIdToSliceQuery } from "./slice-id";

const CATEGORICAL_MATRICES = new Set([
  wellKnownDatasets.mutations_prioritized,
  wellKnownDatasets.mutation_protein_change,
]);

// Returns a Promise of { success, convertedContext }.
//
// We make a best effort to return a `convertedContext` no matter what. If it
// contains some broken dataset IDs or identifiers, it's still returned by
// `success` is set false. That way it can be passed into ContextBuilder when
// the user can attempt to repair it.
//
// `success: true` indicates that the context was passed to the evaluator and
// that did not cause an error.
export async function convertContextV1toV2(
  context: DataExplorerContext
): Promise<{
  success: boolean;
  convertedContext: DataExplorerContextV2;
}> {
  if ("dimension_type" in context) {
    throw new Error("Already a V2 context!");
  }

  // Simplest case to satisfy:
  // a context with a trivial expression containing no variables.
  // https://jsonlogic.com/#always-and-never
  if (typeof context.expr !== "object" && context.expr !== null) {
    return {
      success: true,
      convertedContext: {
        name: context.name,
        dimension_type: context.context_type,
        expr: context.expr,
        vars: {},
      },
    };
  }

  // `null` is technically a valid value (JsonLogic will evaluate it without
  // error) but is not used in practice and probably indictative of a problem.
  if (context.expr === null) {
    throw new Error("Unexpected null context expression");
  }

  const dimTypes = await cached(breadboxAPI).getDimensionTypes();
  const hasValidDimensionType =
    context.context_type === null ||
    context.context_type === "custom" ||
    dimTypes.some((dt) => dt.name === context.context_type);

  if (!hasValidDimensionType) {
    showInfoModal({
      title: "Error reading context",
      closeButtonText: "OK",
      content: <div>Invalid dimension type “{context.context_type}”.</div>,
    });

    throw new Error(`Invalid dimension type “${context.context_type}”.`);
  }

  // Extract the variables from the expression.
  const varTypes: Record<
    string,
    "continuous" | "categorical" | "list_strings"
  > = {};

  JSON.parse(JSON.stringify(context.expr), (_, value) => {
    if (Array.isArray(value)) {
      const varName = value[0]?.var;
      const varValue = value[1];

      if (varName) {
        varTypes[varName] = (() => {
          // Assume all arrays are lists of strings (we don't support other
          // list types).
          if (Array.isArray(varValue)) {
            return "list_strings";
          }

          return typeof varValue === "number" ? "continuous" : "categorical";
        })();
      }
    }

    return value;
  });

  // `vars` did not exist on V1. It now serves
  // to map slice IDs into SliceQuery objects.
  const vars: Record<string, DataExplorerContextVariable> = {};

  for (const varName of Object.keys(varTypes)) {
    if (varName === "entity_label") {
      vars[varName] = {
        dataset_id: `${context.context_type}_metadata`,
        identifier_type: "column",
        identifier: "label",
        source: "metadata_column",
      };
    } else {
      const sliceQuery = sliceIdToSliceQuery(
        varName,
        varTypes[varName],
        context.context_type
      );

      let source: DataExplorerContextVariable["source"] = "matrix_dataset";

      if (
        varTypes[varName] === "categorical" &&
        !CATEGORICAL_MATRICES.has(sliceQuery.dataset_id)
      ) {
        source = sliceQuery.dataset_id.endsWith("_metadata")
          ? "metadata_column"
          : "tabular_dataset";
      }

      vars[varName] = { ...sliceQuery, source };

      if (
        varTypes[varName] === "continuous" ||
        varTypes[varName] === "list_strings"
      ) {
        vars[varName].label = sliceQuery.identifier;
      }
    }
  }

  // Do a pass over the dataset IDs and make sure they're valid. By convention,
  // a given_id formatted as "<DIM_TYPE_NAME>_metadata" should exist (and that
  // stable identifier is usually preferred) but if it doesn't we'll fall back
  // to the metadata dataset's regular ID.
  if (Object.values(vars).some((v) => v.dataset_id.endsWith("_metadata"))) {
    const datasets = await cached(breadboxAPI).getDatasets();

    for (const varName of Object.keys(vars)) {
      const variable = vars[varName];

      if (variable.dataset_id.endsWith("_metadata")) {
        const dimTypeName = variable.dataset_id.replace(/_metadata$/, "");
        const dimType = dimTypes.find((dt) => dt.name === dimTypeName);

        if (dimType?.metadata_dataset_id) {
          const regularId = dimType.metadata_dataset_id;
          const dataset = datasets.find((d) => d.id === regularId);

          if (dataset && dataset.given_id !== variable.dataset_id) {
            vars[varName].dataset_id = regularId;
          }
        }
      }
    }
  }

  const convertedContext = {
    name: context.name,
    dimension_type:
      context.context_type === "custom" ? null : context.context_type,
    // The expression remains unchanged. What used to be recongized as slice
    // IDs now act as variable names (i.e. keys into the `vars` object).
    expr: context.expr,
    vars,
  } as DataExplorerContextV2;

  // FIXME: For now we'll call this a success, even though such a context won't
  // work if you try to evaluate it. It can function as the `context` in a
  // DataExplorerPlotConfigDimension (meaning the DimensionSelect component can
  // interpret it).
  if (context.context_type === "custom" || context.context_type === null) {
    return { success: true, convertedContext };
  }

  try {
    const result = await cached(breadboxAPI).evaluateContext(convertedContext);
    // We'll consider it a failure if the context produces no results. That's
    // probably indicative of a problem (even though the API request itself
    // succeeded).
    const success = result.ids.length > 0;

    return { success, convertedContext };
  } catch {
    return {
      success: false,
      convertedContext,
    };
  }
}
