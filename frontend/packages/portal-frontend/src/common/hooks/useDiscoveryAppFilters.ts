import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Filter,
  normalizeFilters,
  withUpdatedFilter,
  getChangedFilters,
} from "src/common/models/discoveryAppFilters";

export default function useDiscoveryAppFilters(
  data: Record<string, any[]> | null,
  filterDefinitions: any[]
) {
  const [filters, setFilters] = useState<Filter[] | null>(null);
  const initialFilters = useRef<Filter[] | null>(null);

  useEffect(() => {
    if (data) {
      initialFilters.current = normalizeFilters(data, filterDefinitions);
      setFilters(initialFilters.current);
    } else {
      setFilters(null);
    }
  }, [data, filterDefinitions]);

  // TODO: try not to use `any` here for the value type.
  // It should be possible to narrow the type based on the
  // filter's `kind` property.
  const updateFilter = useCallback((key: string, value: any) => {
    setFilters(withUpdatedFilter(key, value));
  }, []);

  const resetFilters = useCallback(
    () => setFilters(initialFilters.current),
    []
  );

  const changedFilters = useMemo(
    () => getChangedFilters(initialFilters.current, filters),
    [filters]
  );

  return { filters, updateFilter, resetFilters, changedFilters };
}
