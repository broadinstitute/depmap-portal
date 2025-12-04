import { useEffect, useRef, useState } from "react";
import { isValidSliceQuery } from "@depmap/types";
import {
  dataExplorerAPI,
  DataExplorerApiResponse,
} from "../../../services/dataExplorerAPI";
import { useContextBuilderState } from "../state/ContextBuilderState";

export default function useDomain(varName: string | null) {
  const [isLoading, setIsLoading] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [domain, setDomain] = useState<
    DataExplorerApiResponse["fetchVariableDomain"] | null
  >(null);
  const { vars } = useContextBuilderState();
  const latestRequestId = useRef(0);

  const variable = varName ? vars[varName] : null;

  useEffect(() => {
    if (!isValidSliceQuery(variable)) {
      setDomain(null);
      setIsLoading(false);
      return;
    }

    const requestId = ++latestRequestId.current;

    setIsLoading(true);
    setHasError(false);

    dataExplorerAPI
      .fetchVariableDomain(variable)
      .then((result) => {
        if (requestId === latestRequestId.current) {
          setDomain(result);
          setHasError(false);
        }
      })
      .catch(() => {
        if (requestId === latestRequestId.current) {
          setDomain(null);
          setHasError(true);
        }
      })
      .finally(() => setIsLoading(false));
  }, [variable]);

  return { isLoading, hasError, domain };
}
