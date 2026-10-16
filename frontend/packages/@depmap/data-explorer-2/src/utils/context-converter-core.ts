// The conversion itself, free of React and the DOM so the standalone Node
// bundle can use it (see embed-frontend/webpack.node.js). The browser entry
// point, which also shows a modal on failure, is context-converter.tsx.
import { cached, breadboxAPI } from "@depmap/api";
import {
  DataExplorerContext,
  DataExplorerContextV2,
  DataExplorerContextVariable,
  MatrixDataset,
} from "@depmap/types";
import wellKnownDatasets from "../constants/wellKnownDatasets";
import { sliceIdToSliceQuery } from "./slice-id";

const CATEGORICAL_MATRICES = new Set([
  wellKnownDatasets.legacy_msi,
  wellKnownDatasets.legacy_prism_pools,
  wellKnownDatasets.mutations_prioritized,
  wellKnownDatasets.mutation_protein_change,
]);

// Index of the last character `.` would refuse to match (a line terminator),
// or -1.
const lastLineTerminator = (s: string) => {
  for (let i = s.length - 1; i >= 0; i -= 1) {
    const c = s[i];

    if (c === "\n" || c === "\r" || c === "\u2028" || c === "\u2029") {
      return i;
    }
  }

  return -1;
};

// Strips a trailing " (...)" from a label like "afatinib (BRD:...)".
//
// This is a pair of indexOf scans rather than the regexes / (?=\(.*$)/ and
// /-\(.*$/, which are polynomial on strings with many repetitions of "-(" (the
// `.*$` is re-scanned from every candidate). They match the same strings: a
// " (" or "-(" counts only if no line terminator follows its "(".
const extractCompoundName = (label?: string | null) => {
  if (!label) {
    return null;
  }

  const from = Math.max(0, lastLineTerminator(label) - 1);
  const idx = label.indexOf(" (", from); // space before '('

  if (idx === -1 || label.indexOf("-(", from) !== -1) {
    return null;
  }

  return label.slice(0, idx);
};

const rewriteCompoundExpr = (expr: object) => {
  return JSON.parse(JSON.stringify(expr), (_, value) => {
    if (typeof value === "string") {
      return extractCompoundName(value) || value;
    }

    return value;
  });
};

function simplifyVarNames(context: DataExplorerContextV2) {
  const nextVars: Record<string, DataExplorerContextVariable> = {};
  let i = 0;

  const nextExpr = JSON.parse(
    JSON.stringify(context.expr, (key, value) => {
      if (key === "var") {
        const isSpecialVarName =
          value === "entity_label" || value === "given_id";
        // Only change the variable name if it's
        // not a name with special significance.
        let newVarName = isSpecialVarName ? value : `${i++}`;

        // Edge case: featureless data should never use "entity_label".
        if (context.dimension_type === null && value === "entity_label") {
          newVarName = "given_id";
        }

        if (newVarName !== "given_id") {
          nextVars[newVarName] = context.vars[value];
        }

        return newVarName;
      }

      return value;
    })
  );

  return {
    ...context,
    expr: nextExpr,
    vars: nextVars,
  } as DataExplorerContextV2;
}

export class InvalidDimensionTypeError extends Error {
  constructor(public dimensionType: string) {
    super(`Invalid dimension type “${dimensionType}”.`);
    this.name = "InvalidDimensionTypeError";
    Object.setPrototypeOf(this, InvalidDimensionTypeError.prototype);
  }
}

export async function convertContextV1toV2Core(
  context: DataExplorerContext
): Promise<DataExplorerContextV2> {
  if ("dimension_type" in context) {
    throw new Error("Already a V2 context!");
  }

  const context_type = context.context_type;
  let dimension_type: string | null = context_type;

  if (context_type === "custom") {
    dimension_type = null;
  }

  if (context_type === "compound_experiment") {
    dimension_type = "compound_v2";
  }

  // Simplest case to satisfy:
  // a context with a trivial expression containing no variables.
  // https://jsonlogic.com/#always-and-never
  if (typeof context.expr !== "object" && context.expr !== null) {
    return {
      name: context.name,
      dimension_type: dimension_type!,
      expr: context.expr,
      vars: {},
    };
  }

  // `null` is technically a valid value (JsonLogic will evaluate it without
  // error) but is not used in practice and probably indictative of a problem.
  if (context.expr === null) {
    throw new Error("Unexpected null context expression");
  }

  const dimTypes = await cached(breadboxAPI).getDimensionTypes();
  const hasValidDimensionType =
    context_type === "custom" ||
    context_type === "compound_experiment" ||
    dimTypes.some((dt) => dt.name === context_type);

  if (!hasValidDimensionType) {
    throw new InvalidDimensionTypeError(context_type);
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
      if (dimension_type !== null) {
        vars[varName] = {
          dataset_id: `${dimension_type}_metadata`,
          identifier_type: "column",
          identifier: dimension_type === "depmap_model" ? "depmap_id" : "label",
          source: "property",
        };
      }
    } else {
      const sliceQuery = sliceIdToSliceQuery(
        varName,
        varTypes[varName],
        context_type
      );

      let source: DataExplorerContextVariable["source"] = "custom";

      if (
        varTypes[varName] === "categorical" &&
        !CATEGORICAL_MATRICES.has(sliceQuery.dataset_id)
      ) {
        source = "property";
      }

      if (sliceQuery.dataset_id === wellKnownDatasets.subtype_matrix) {
        source = "property";
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

  const datasets = await cached(breadboxAPI).getDatasets();

  for (const varName of Object.keys(vars)) {
    const variable = vars[varName];

    // Do a pass over the dataset IDs and make sure they're valid. By convention,
    // a given_id formatted as "<DIM_TYPE_NAME>_metadata" should exist (and that
    // stable identifier is usually preferred) but if it doesn't we'll fall back
    // to the metadata dataset's regular ID.
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

    // Also make sure all matrix slices have a slice_type.
    if (
      variable.identifier_type === "feature_id" ||
      variable.identifier_type === "feature_label"
    ) {
      const dataset = datasets.find((d) =>
        [d.id, d.given_id].includes(variable.dataset_id)
      );
      const slice_type = (dataset as MatrixDataset)?.feature_type_name || null;
      vars[varName].slice_type = slice_type;
    }

    if (
      variable.identifier_type === "sample_id" ||
      variable.identifier_type === "sample_label"
    ) {
      const dataset = datasets.find((d) =>
        [d.id, d.given_id].includes(variable.dataset_id)
      );
      const slice_type = (dataset as MatrixDataset)?.sample_type_name || null;
      vars[varName].slice_type = slice_type;
    }
  }

  if (context.context_type === "compound_experiment") {
    return {
      name: extractCompoundName(context.name),
      dimension_type,
      expr: rewriteCompoundExpr(context.expr),
    } as DataExplorerContextV2;
  }

  return simplifyVarNames({
    name: context.name,
    dimension_type:
      context.context_type === "custom" ? null : context.context_type,
    // The expression remains unchanged. What used to be recongized as slice
    // IDs now act as variable names (i.e. keys into the `vars` object).
    expr: context.expr,
    vars,
  } as DataExplorerContextV2);
}
