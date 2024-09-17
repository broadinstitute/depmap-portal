import { useEffect, useState } from "react";
import { ContextSummaryResponse, fetchContextSummary } from "../../../api";
import { isCompleteExpression, isPartialSliceId } from "../../../utils/misc";
import {
  getOperator,
  isListOperator,
  normalizeExpr,
} from "../contextBuilderUtils";

export const isEditableAsCellLineList = (slice_type: string, expr: any) => {
  const op = getOperator(expr);

  return (
    isListOperator(op) &&
    slice_type === "depmap_model" &&
    ["entity_label", "slice/cell_line_display_name/all/label"].includes(
      expr[op][0]?.var
    )
  );
};

export const getSelectedCellLines = (expr: any) => {
  const op = getOperator(expr);
  return expr[op]?.[1] || [];
};

export const useEvaluatedExpressionResult = (slice_type: string, expr: any) => {
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

export const isEmptyListExpr = (expr: any) => {
  if (!expr) {
    return false;
  }

  const op = getOperator(expr);

  if (!op) {
    return false;
  }

  return (
    isListOperator(op) &&
    expr[op][0].var &&
    !isPartialSliceId(expr[op][0].var) &&
    expr[op][1] === null
  );
};
