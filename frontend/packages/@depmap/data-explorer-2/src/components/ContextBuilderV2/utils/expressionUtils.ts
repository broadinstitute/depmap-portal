import { get_operator, get_values } from "json-logic-js";
import { DataExplorerApiResponse } from "../../../services/dataExplorerAPI";

export const MAX_CONDITIONS = 10;

export const opLabels = {
  "==": "is",
  "!=": "is not",
  in: "is in list",
  "!in": "is not in list",
  or: "or",
  and: "and",
  "<": "<",
  "<=": "≤",
  ">": ">",
  ">=": "≥",
  has_any: "has any of",
  "!has_any": "has none of",
};

export type OperatorType = keyof typeof opLabels;

const supportedOperators = new Set(Object.keys(opLabels));

export const operatorsByValueType = {
  continuous: new Set(["<", "<=", ">", ">=", "==", "!="]),
  text: new Set(["==", "!=", "in", "!in"]),
  categorical: new Set(["==", "!=", "in", "!in"]),
  list_strings: new Set(["has_any", "!has_any"]),
};

export type ValueType = keyof typeof operatorsByValueType;

export const defaultOperatorByValueType: Record<ValueType, OperatorType> = {
  continuous: ">=",
  text: "==",
  categorical: "==",
  list_strings: "has_any",
};

export const isListOperator = (op: OperatorType) => {
  return ["in", "!in", "has_any", "!has_any"].includes(op);
};

export const getOperator = (expr: Expr): OperatorType => {
  const op = get_operator(expr as object);

  if (op && supportedOperators.has(op)) {
    return op as OperatorType;
  }

  throw new Error(`Unsupported operator "${op}"`);
};

export type Expr = string | number | null | { [key: string]: Expr } | Expr[];

export const isBoolean = (expr: Expr): expr is Record<"and" | "or", Expr[]> => {
  return (
    expr !== null &&
    typeof expr === "object" &&
    ["and", "or"].some((op) => op in expr)
  );
};

export type RelationExpr = Record<
  OperatorType,
  [{ var: string } | null, string | string[] | number | null]
>;

export const isRelation = (expr: Expr): expr is RelationExpr => {
  return (
    expr !== null &&
    typeof expr === "object" &&
    [...supportedOperators].some((op) => op in expr)
  );
};

const isVar = (expr: Expr): expr is Record<"var", string> => {
  return expr !== null && typeof expr === "object" && "var" in expr;
};

export const getVariableNames = (expr: Expr) => {
  const varNames: string[] = [];

  if (isVar(expr)) {
    varNames.push(expr.var);
  }

  if (isBoolean(expr) || isRelation(expr)) {
    get_values(expr).forEach((value: unknown) => {
      getVariableNames(value as Expr).forEach((vn) => varNames.push(vn));
    });
  }

  return varNames;
};

export const ceil = (num: number) => Math.ceil(num * 100) / 100;

export const floor = (num: number) => Math.floor(num * 100) / 100;

export const round = (num: number) =>
  Math.round((num + Number.EPSILON) * 100) / 100;

export const makeCompatibleExpression = (
  expr: Expr,
  domain: DataExplorerApiResponse["fetchVariableDomain"] | null
) => {
  if (!isRelation(expr) || !domain) {
    return expr;
  }

  const op = getOperator(expr);
  const variable = expr[op][0];
  const value = expr[op][1];
  const value_type = domain.value_type;

  let nextOp = op;
  let nextValue = value;

  if (value == null || !operatorsByValueType[value_type].has(op)) {
    nextValue = null;
    nextOp = defaultOperatorByValueType[value_type];
  }

  if (value_type === "continuous") {
    const { min, max, isBinary, isBinaryish, isAllIntegers } = domain;

    if (isBinary && !["==", "!="].includes(nextOp)) {
      nextOp = "==";
    }

    if (isBinaryish && typeof nextValue !== "number") {
      nextOp = ">=";
    }

    if (
      typeof nextValue !== "number" ||
      (isAllIntegers && !Number.isInteger(nextValue))
    ) {
      if (isBinary || isBinaryish) {
        nextValue = 1;
      } else {
        nextValue = nextOp === "<" || nextOp === "<=" ? ceil(max) : floor(min);
      }
    } else if ((nextValue as number) < min) {
      nextValue = isBinary || isBinaryish ? 0 : floor(min);
    } else if ((nextValue as number) > max) {
      nextValue = isBinary || isBinaryish ? 1 : floor(min);
    }
  }

  if (value_type === "text" || value_type === "categorical") {
    if (nextValue && Array.isArray(nextValue)) {
      nextValue = nextValue.filter((val) =>
        domain.unique_values?.includes(val)
      );
      if (nextValue.length === 0) {
        nextValue = null;
      }
    } else if (
      nextValue &&
      !domain.unique_values?.find((val) => val === nextValue)
    ) {
      nextValue = null;
    }
  }

  if (op === nextOp && value === nextValue) {
    return expr;
  }

  return { [nextOp]: [variable, nextValue] };
};

export function flattenExpr(expr: Expr) {
  if (!isBoolean(expr)) {
    return expr;
  }

  if ("and" in expr && expr.and.length === 1) {
    return expr.and[0];
  }

  if ("or" in expr && expr.or.length === 1) {
    return expr.or[0];
  }

  // Can't flatten because there's more than one alternative so return as-is.
  return expr;
}
