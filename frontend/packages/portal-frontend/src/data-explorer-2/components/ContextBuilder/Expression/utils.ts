import { useEffect, useState } from "react";
import {
  evaluateContextWithSummary,
  isCompleteExpression,
  isPartialSliceId,
} from "@depmap/data-explorer-2";
import {
  EvaluateContextSummarizedResult,
  getOperator,
  isListOperator,
  normalizeExpr,
} from "src/data-explorer-2/components/ContextBuilder/contextBuilderUtils";

export const isEditableAsCellLineList = (entity_type: string, expr: any) => {
  const op = getOperator(expr);

  return (
    isListOperator(op) &&
    entity_type === "depmap_model" &&
    ["entity_label", "slice/cell_line_display_name/all/label"].includes(
      expr[op][0]?.var
    )
  );
};

export const getSelectedCellLines = (expr: any) => {
  const op = getOperator(expr);
  return expr[op]?.[1] || [];
};

export const useEvaluatedExpressionResult = (
  entity_type: string,
  expr: any
) => {
  const [result, setResult] = useState<EvaluateContextSummarizedResult | null>(
    null
  );

  useEffect(() => {
    (async () => {
      if (isCompleteExpression(expr)) {
        const fetchedResult = await evaluateContextWithSummary({
          context_type: entity_type,
          expr: normalizeExpr(expr),
        });

        setResult(fetchedResult);
      } else {
        setResult(null);
      }
    })();
  }, [expr, entity_type]);

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
