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

  // requestId is incremented every time a new request starts
  const latestRequestId = useRef(0);

  const { dimension_type, vars, fullySpecifiedVars } = useContextBuilderState();

  useEffect(() => {
    const varNames = getVariableNames(expr);

    const isReady =
      isCompleteExpression(expr) &&
      varNames.every((v) => fullySpecifiedVars.has(v));

    if (!isReady) {
      setNumMatches(null);
      setHasError(false);
      return;
    }

    const exprVars = Object.fromEntries(
      Object.entries(vars).filter(([key]) => varNames.includes(key))
    ) as Record<string, SliceQuery>;

    const requestId = ++latestRequestId.current;

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

        // Only update state if this request is still the latest
        if (requestId === latestRequestId.current) {
          setMatchingIds(result.ids);
          setNumMatches(result.ids.length);
          setNumCandidates(result.num_candidates);
          setIsLoading(false);
          setHasError(false);
        }
      } catch (e) {
        console.error(e);

        if (requestId === latestRequestId.current) {
          setNumMatches(null);
          setIsLoading(false);
          setHasError(true);
        }
      }
    })();
  }, [expr, dimension_type, fullySpecifiedVars, vars]);

  return { isLoading, hasError, matchingIds, numMatches, numCandidates };
}

export default useMatches;
