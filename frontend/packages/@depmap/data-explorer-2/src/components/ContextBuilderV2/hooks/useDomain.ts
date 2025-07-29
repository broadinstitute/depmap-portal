import { useEffect, useState } from "react";
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

  const variable = varName ? vars[varName] : null;

  useEffect(() => {
    if (isValidSliceQuery(variable)) {
      setIsLoading(true);
      setHasError(false);

      dataExplorerAPI
        .fetchVariableDomain(variable)
        .then(setDomain)
        .catch(() => {
          setDomain(null);
          setHasError(true);
        })
        .finally(() => setIsLoading(false));
    } else {
      setDomain(null);
      setIsLoading(false);
    }
  }, [variable]);

  return { isLoading, hasError, domain };
}
