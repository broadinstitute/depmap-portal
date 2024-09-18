import { useEffect, useState } from "react";
import { ContextSummaryResponse, fetchContextSummary } from "../../../api";
import { isCompleteExpression, isPartialSliceId } from "../../../utils/misc";
import {
  Expr,
  getOperator,
  isComparison,
  isListOperator,
  isVar,
  normalizeExpr,
} from "../contextBuilderUtils";

export const isEditableAsCellLineList = (slice_type: string, expr: Expr) => {
  const op = getOperator(expr);
  let varname = "";

  if (isComparison(expr)) {
    const lhs = expr[op][0];

    if (isVar(lhs)) {
      varname = lhs.var;
    }
  }

  return (
    isListOperator(op) &&
    slice_type === "depmap_model" &&
    ["entity_label", "slice/cell_line_display_name/all/label"].includes(varname)
  );
};

export const getSelectedCellLines = (expr: Expr) => {
  if (!isComparison(expr)) {
    return [];
  }

  const op = getOperator(expr);
  return expr[op][1] as string[];
};

export const useEvaluatedExpressionResult = (
  slice_type: string,
  expr: Expr
) => {
  const [result, setResult] = useState<ContextSummaryResponse | null>(null);

  // TODO: re-implement this by calling the other endpoint
  useEffect(() => {
    (async () => {
      if (isCompleteExpression(expr)) {
        const fetchedResult = await fetchContextSummary({
          context_type: slice_type,
          expr: normalizeExpr(expr),
        });

        setResult(fetchedResult);
      } else {
        setResult(null);
      }
    })();
  }, [expr, slice_type]);

  return result;
};

export const isEmptyListExpr = (expr: Expr) => {
  if (!expr) {
    return false;
  }

  if (!isComparison(expr)) {
    return false;
  }

  const op = getOperator(expr);
  const lhs = expr[op][0];
  const varname = isVar(lhs) ? lhs.var : null;

  return (
    isListOperator(op) &&
    varname &&
    !isPartialSliceId(varname) &&
    expr[op][1] === null
  );
};
