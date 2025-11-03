import { useEffect, useRef, useState } from "react";
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
  const latestPromise = useRef<Promise<unknown>>(Promise.resolve());

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

      let promise: Promise<{
        ids: string[];
        labels: string[];
        num_candidates: number;
      }> = Promise.resolve({ ids: [], labels: [], num_candidates: 0 });

      (async () => {
        try {
          promise = cached(breadboxAPI).evaluateContext(
            simplifyVarNames({
              dimension_type,
              expr: flattenExpr(expr) as DataExplorerContextExpression,
              vars: exprVars,
            } as DataExplorerContextV2)
          );

          latestPromise.current = promise;
          const result = await promise;

          if (promise === latestPromise.current) {
            setMatchingIds(result.ids);
            setNumMatches(result.ids.length);
            setNumCandidates(result.num_candidates);
            setIsLoading(false);
          }
        } catch (e) {
          window.console.error(e);

          if (promise === latestPromise.current) {
            setNumMatches(null);
            setHasError(true);
            setIsLoading(false);
          }
        }
      })();
    } else {
      setNumMatches(null);
      setHasError(false);
    }
  }, [expr, dimension_type, fullySpecifiedVars, vars]);

  return { isLoading, hasError, matchingIds, numMatches, numCandidates };
}

export default useMatches;
