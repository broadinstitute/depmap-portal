import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Filter,
  normalizeFilters,
  withUpdatedFilter,
  getChangedFilters,
} from "src/common/models/discoveryAppFilters";
import debounce from "lodash.debounce";

export default function useContextExplorerFilters(
  data: Record<string, any[]> | null,
  filterDefinitions: any[],
  stickyFilterMode: boolean = false
) {
  // filters and transientFilterState are modeling the same information (a set of filters to apply)
  // however, they are used differently and updated differently.
  // `transientFilterState` should be used for rendering the filter controls and this is updated as soon as
  // any control's state is updated. These filters should not be used to update anything that is not interactive.
  // For things that are slow/computed from the filtering state, use `filters` instead. The value of `filters` will
  // be set to the value of `transientFilterState` after 500ms of `transientFilterState`'s last update. I'm using
  // lodash's `debounce` to collapse multiple calls to setTransientFilterState into a single final call to setFilters so that
  // we don't get intermediate renders from `filters` changing frequently.
  const [filters, setFilters] = useState<Filter[] | null>(null);
  const [transientFilterState, setTransientFilterState] = useState<
    Filter[] | null
  >(null);
  const initialFilters = useRef<Filter[] | null>(null);
  const defaultFilters = useRef<Filter[] | null>(null);

  const [stickyFilters, setStickyFilters] = useState<Filter[] | null>(null);

  useEffect(() => {
    if (!data && filters && stickyFilterMode) {
      setStickyFilters(filters);
    }
  }, [data, filters, stickyFilterMode]);

  useEffect(() => {
    if (data) {
      defaultFilters.current = normalizeFilters(data, filterDefinitions);
      initialFilters.current = normalizeFilters(
        data,
        stickyFilters && stickyFilterMode ? stickyFilters : filterDefinitions
      );
      setFilters(initialFilters.current);
      setTransientFilterState(initialFilters.current);
    } else {
      setTransientFilterState(null);
      setFilters(null);
    }
  }, [data, filterDefinitions, stickyFilterMode, stickyFilters]);

  const debouncedSetFilters = useMemo(
    () => debounce((filters_) => setFilters(filters_), 100),
    [setFilters]
  );

  // TODO: try not to use `any` here for the value type.
  // It should be possible to narrow the type based on the
  // filter's `kind` property.
  const updateFilter = useCallback(
    (key: string, value: any) => {
      const newFilters = withUpdatedFilter(key, value);
      setTransientFilterState(newFilters);
      debouncedSetFilters(newFilters);
    },
    [debouncedSetFilters]
  );

  const resetFilters = useCallback(() => {
    setFilters(initialFilters.current);
    setTransientFilterState(initialFilters.current);
  }, []);

  const changedFilters = useMemo(
    () => getChangedFilters(initialFilters.current, transientFilterState),
    [transientFilterState]
  );

  return {
    transientFilterState,
    filters,
    updateFilter,
    resetFilters,
    changedFilters,
    defaultFilters,
  };
}
