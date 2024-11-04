import { useEffect, useState } from "react";
import { isValidSliceQuery } from "@depmap/types";
import {
  useDataExplorerApi,
  VariableDomain,
} from "../../../contexts/DataExplorerApiContext";
import { useContextBuilderState } from "../state/ContextBuilderState";

export default function useDomain(varName: string | null) {
  const api = useDataExplorerApi();
  const [isLoading, setIsLoading] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [domain, setDomain] = useState<VariableDomain | null>(null);
  const { vars } = useContextBuilderState();

  const variable = varName ? vars[varName] : null;

  useEffect(() => {
    if (isValidSliceQuery(variable)) {
      setIsLoading(true);
      setHasError(false);

      api
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
  }, [api, variable]);

  return { isLoading, hasError, domain };
}
