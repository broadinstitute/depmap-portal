import { useEffect, useState } from "react";
import { breadboxAPI, cached } from "@depmap/api";
import {
  DataExplorerContextExpression,
  DataExplorerContextV2,
  SliceQuery,
} from "@depmap/types";
import { isCompleteExpression } from "../../../utils/misc";
import { Expr, getVariableNames, flattenExpr } from "../utils/expressionUtils";
import simplifyVarNames from "../utils/simplifyVarNames";
import { useContextBuilderState } from "../state/ContextBuilderState";

function useMatches(expr: Expr) {
  const [matchingIds, setMatchingIds] = useState<string[]>([]);
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
      const exprVars = Object.fromEntries(
        Object.entries(vars).filter(([key]) => varNames.includes(key))
      ) as Record<string, SliceQuery>;

      setIsLoading(true);
      setHasError(false);

      (async () => {
        try {
          const result = await cached(breadboxAPI).evaluateContext(
            simplifyVarNames({
              dimension_type,
              expr: flattenExpr(expr) as DataExplorerContextExpression,
              vars: exprVars,
            } as DataExplorerContextV2)
          );

          setMatchingIds(result.ids);
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
  }, [expr, dimension_type, fullySpecifiedVars, vars]);

  return { isLoading, hasError, matchingIds, numMatches, numCandidates };
}

export default useMatches;
