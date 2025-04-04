import { get_operator, get_values } from "json-logic-js";
import { DataExplorerContext } from "@depmap/types";
import { isSampleType, urlLibEncode } from "../../utils/misc";

export const opLabels = {
  "==": "is",
  "!=": "is not",
  in: "is in list",
  "!in": "is not in list",
  or: "or",
  and: "and",
  ">": ">",
  ">=": "≥",
  "<": "<",
  "<=": "≤",
  has_any: "has any of",
  "!has_any": "has none of",
};

const supportedOperators = new Set(Object.keys(opLabels));

export type OperatorType = keyof typeof opLabels;

export type Expr = string | number | null | { [key: string]: Expr } | Expr[];

export const isBoolean = (expr: Expr): expr is Record<"and" | "or", Expr[]> => {
  return (
    expr !== null &&
    typeof expr === "object" &&
    ["and", "or"].some((op) => op in expr)
  );
};

export const isComparison = (
  expr: Expr
): expr is Record<OperatorType, [Expr, Expr]> => {
  return (
    expr !== null &&
    typeof expr === "object" &&
    ["==", "!=", "in", "!in", ">", ">=", "<", "<=", "has_any", "!has_any"].some(
      (op) => op in expr
    )
  );
};

export const isListOperator = (op: string) => {
  return ["in", "!in", "has_any", "!has_any"].includes(op);
};

export const ceil = (num: number) =>
  Math.ceil((num + Number.EPSILON) * 100) / 100;

export const floor = (num: number) => Math.floor(num * 100) / 100;

export const round = (num: number) => Math.round(num * 100) / 100;

export const makeSliceId = (
  slice_type: string,
  dataset_id: string,
  feature: string
) => {
  const featureType = isSampleType(slice_type) ? "transpose_label" : "label";

  return [
    "slice",
    urlLibEncode(dataset_id),
    urlLibEncode(feature),
    featureType,
  ].join("/");
};

export const makePartialSliceId = (dataset_id: string) => {
  return `slice/${urlLibEncode(dataset_id)}/`;
};

export const sliceLabelFromSliceId = (
  slice_id: string | null,
  dataset_id: string | null
) => {
  if (!slice_id || !dataset_id) {
    return null;
  }

  const encodedLabel = slice_id
    .replace(`slice/${urlLibEncode(dataset_id)}/`, "")
    .replace(/\/[^/]*$/, "");

  return decodeURIComponent(encodedLabel);
};

export const getOperator = (expr: Expr): OperatorType => {
  const op = get_operator(expr as object);

  if (op && supportedOperators.has(op)) {
    return op as OperatorType;
  }

  throw new Error(`Unsupported operator "${op}"`);
};

export const isVar = (expr: Expr): expr is Record<"var", string> => {
  return expr !== null && typeof expr === "object" && "var" in expr;
};

// To make it easier to edit expressions, we want make sure there's a top-level
// boolean wrapper expression (even if it consists of a single subexpression).
export const denormalizeExpr = (expr: DataExplorerContext["expr"] | null) => {
  if (expr == null || typeof expr !== "object") {
    return null;
  }

  return isBoolean(expr) ? expr : { and: [expr] };
};

// Before saving, we put such an expression back to normal.
export const normalizeExpr = (expr: Expr) => {
  if (!isBoolean(expr) || get_values(expr as object).length > 1) {
    return expr as DataExplorerContext["expr"];
  }

  const op = getOperator(expr) as "and" | "or";
  return expr[op][0] as DataExplorerContext["expr"];
};

export const getValueType = (
  metadataSlices:
    | Record<string, { valueType: "categorical" | "list_strings" | "binary" }>
    | undefined,
  slice_id: string | null
) => {
  if (!slice_id) {
    return null;
  }

  if (slice_id === "entity_label") {
    return "categorical";
  }

  if (metadataSlices) {
    if (slice_id in metadataSlices) {
      return metadataSlices[slice_id].valueType;
    }

    const sliceIdPrefix = slice_id.replace(/(slice\/[^/]+\/).*/, "$1");

    if (sliceIdPrefix in metadataSlices) {
      return metadataSlices[sliceIdPrefix].valueType;
    }
  }

  return "continuous";
};
