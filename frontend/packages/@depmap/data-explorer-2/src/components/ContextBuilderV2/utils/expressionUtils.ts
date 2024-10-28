import { get_operator, get_values } from "json-logic-js";
import { VariableDomain } from "../../../contexts/DataExplorerApiContext";

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
  continuous: new Set(["<", "<=", ">", ">="]),
  categorical: new Set(["==", "!=", "in", "!in"]),
  list_strings: new Set(["has_any", "!has_any"]),
};

export type ValueType = keyof typeof operatorsByValueType;

export const defaultOperatorByValueType: Record<ValueType, OperatorType> = {
  continuous: ">=",
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

export const ceil = (num: number) =>
  Math.ceil((num + Number.EPSILON) * 100) / 100;

export const floor = (num: number) =>
  Math.floor((num + Number.EPSILON) * 100) / 100;

export const round = (num: number) =>
  Math.round((num + Number.EPSILON) * 100) / 100;

export const makeCompatibleExpression = (
  expr: Expr,
  domain: VariableDomain | null
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

  if (!operatorsByValueType[value_type].has(op)) {
    nextOp = defaultOperatorByValueType[value_type];
  }

  if (value_type === "continuous") {
    const { min, max } = domain;

    if (typeof nextValue !== "number") {
      nextValue = nextOp === "<" || nextOp === "<=" ? ceil(max) : floor(min);
    } else if ((nextValue as number) < min) {
      nextValue = floor(min);
    } else if ((nextValue as number) > max) {
      nextValue = ceil(max);
    }
  }

  if (value_type === "categorical") {
    if (nextValue && Array.isArray(nextValue)) {
      nextValue = nextValue.filter((val) => domain.unique_values.includes(val));
    } else if (
      nextValue &&
      !domain.unique_values.find((val) => val === nextValue)
    ) {
      nextValue = null;
    }
  }

  if (op === nextOp && value === nextValue) {
    return expr;
  }

  return { [nextOp]: [variable, nextValue] };
};
