import { useEffect, useState } from "react";
import { breadboxAPI, cached, BreadboxApiResponse } from "@depmap/api";
import { DataExplorerContextV2 } from "@depmap/types";

function useContextResult(context?: DataExplorerContextV2 | null) {
  const [isLoading, setIsLoading] = useState(false);

  const [result, setResult] = useState<
    BreadboxApiResponse["evaluateContext"] | null
  >(null);

  useEffect(() => {
    if (context) {
      setIsLoading(true);

      cached(breadboxAPI)
        .evaluateContext(context)
        .then((nextResult) => {
          setResult(nextResult);
          setIsLoading(false);
        });
    } else {
      setResult(null);
      setIsLoading(false);
    }
  }, [context]);

  return { isLoading, result };
}

export default useContextResult;
