import { get_operator, get_values } from "json-logic-js";
import { urlLibEncode } from "../../utils/misc";

export const isBoolean = (expr: any) => expr?.and || expr?.or;

export const isComparison = (expr: any) =>
  ["==", "!=", "in", "!in", ">", ">=", "<", "<=", "has_any", "!has_any"].some(
    (op) => expr && op in expr
  );

export const isListOperator = (op: string) => {
  return ["in", "!in", "has_any", "!has_any"].includes(op);
};

export const ceil = (num: number) =>
  Math.ceil((num + Number.EPSILON) * 100) / 100;

export const floor = (num: number) =>
  Math.floor((num + Number.EPSILON) * 100) / 100;

export const round = (num: number) =>
  Math.round((num + Number.EPSILON) * 100) / 100;

export const makeSliceId = (
  slice_type: string,
  dataset_id: string,
  feature: string
) => {
  const featureType =
    slice_type === "depmap_model" ? "transpose_label" : "label";

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

type OperatorType = keyof typeof opLabels;

export const getOperator = (expr: any): OperatorType => {
  const op = get_operator(expr);

  if (op) {
    return op as OperatorType;
  }

  throw new Error(`Unknown operator ${Object.keys(expr)[0]}`);
};

export const isVar = (expr: any) => {
  return expr && expr.var;
};

// To make it easier to edit expressions, we want make sure there's a top-level
// boolean wrapper expression (even if it consists of a single subexpression).
export const denormalizeExpr = (expr: Record<string, any>) => {
  if (!expr) {
    return null;
  }

  return expr.and || expr.or ? expr : { and: [expr] };
};

// Before saving, we put such an expression back to normal.
export const normalizeExpr = (expr: Record<string, any>) => {
  if (get_values(expr).length > 1) {
    return expr;
  }

  const op = getOperator(expr);
  return expr[op][0];
};

export const getValueType = (
  categoricalSlices:
    | Record<string, { valueType: "categorical" | "list_strings" }>
    | undefined,
  slice_id: string | null
) => {
  if (!slice_id) {
    return null;
  }

  if (slice_id === "entity_label") {
    return "categorical";
  }

  if (categoricalSlices) {
    if (slice_id in categoricalSlices) {
      return categoricalSlices[slice_id].valueType;
    }

    const sliceIdPrefix = slice_id.replace(/(slice\/[^/]+\/).*/, "$1");

    if (sliceIdPrefix in categoricalSlices) {
      return categoricalSlices[sliceIdPrefix].valueType;
    }
  }

  return "continuous";
};
