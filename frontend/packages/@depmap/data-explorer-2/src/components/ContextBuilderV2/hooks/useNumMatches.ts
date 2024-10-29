import { useEffect, useState } from "react";
import { SliceQuery } from "@depmap/types";
import { useDataExplorerApi } from "../../../contexts/DataExplorerApiContext";
import { isCompleteExpression } from "../../../utils/misc";
import { Expr, isBoolean, getVariableNames } from "../utils/expressionUtils";
import { useContextBuilderState } from "../state/ContextBuilderState";

function useNumMatches(expr: Expr) {
  const api = useDataExplorerApi();
  const [numMatches, setNumMatches] = useState<number | null>(null);
  const [numCandidates, setNumCandidates] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [hasError, setHasError] = useState(false);

  const { dimension_type, vars, fullySpecifiedVars } = useContextBuilderState();

  useEffect(() => {
    const varNames = getVariableNames(expr);

    if (
      isCompleteExpression(expr) &&
      varNames.every((v) => fullySpecifiedVars.has(v))
    ) {
      // TODO: Make this more cacheable. varNames can appear unique even when
      // they represent the same value. I should come up with a normal form for
      // one-off evaluations.
      const exprVars = Object.fromEntries(
        Object.entries(vars).filter(([key]) => varNames.includes(key))
      ) as Record<string, SliceQuery>;

      let flattenedExpr = expr;

      if (isBoolean(expr) && expr.and?.length === 1) {
        flattenedExpr = expr.and[0];
      }

      if (isBoolean(expr) && expr.or?.length === 1) {
        flattenedExpr = expr.or[0];
      }

      setIsLoading(true);
      setHasError(false);

      (async () => {
        try {
          const result = await api.evaluateContext({
            name: "",
            dimension_type,
            expr: flattenedExpr as Record<string, unknown>,
            vars: exprVars,
          });

          setNumMatches(result.ids.length);
          setNumCandidates(result.num_candidates);
        } catch (e) {
          window.console.error(e);
          setNumMatches(null);
          setHasError(true);
        } finally {
          setIsLoading(false);
        }
      })();
    } else {
      setNumMatches(null);
    }
  }, [api, expr, dimension_type, fullySpecifiedVars, vars]);

  return { isLoading, hasError, numMatches, numCandidates };
}

export default useNumMatches;
