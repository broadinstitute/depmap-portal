import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DataExplorerPlotConfigDimensionV2 } from "@depmap/types";
import { useDataExplorerApi } from "../../../contexts/DataExplorerApiContext";
import useCallbacks from "./useCallbacks";
import useSync from "./useSync";
import resolveNextState from "./resolveNextState";
// import { validateDimension } from "./utils";
import { Changes, Mode, State, DEFAULT_STATE } from "./types";

interface Props {
  mode: Mode;
  index_type: string | null;
  value: Partial<DataExplorerPlotConfigDimensionV2> | null;
  onChange: (nextValue: Partial<DataExplorerPlotConfigDimensionV2>) => void;
  initialDataType?: string;
}

export default function useDimensionStateManager({
  mode,
  index_type,
  value,
  onChange,
  initialDataType = "",
}: Props) {
  const api = useDataExplorerApi();
  const isInitialized = useRef(false);
  const [isLoading, setIsLoading] = useState(true);

  const prevIndexType = useRef(index_type);

  const initialState = useRef({
    ...DEFAULT_STATE,
    dataType: initialDataType || null,
    dimension: value || {
      axis_type: mode === "context-only" ? "aggregated_slice" : "raw_slice",
      aggregation: mode === "context-only" ? undefined : "first",
    },
  });

  const [state, setState] = useState<State>(initialState.current);

  // Keeps `value` and `state.dimension` in sync.
  useSync({ value, onChange, state, setState, mode });

  const update = useCallback(
    async (changes: Changes) => {
      setIsLoading(true);

      try {
        const nextState = await resolveNextState(
          api,
          index_type,
          state,
          changes
        );
        setState(nextState);
      } catch (e) {
        window.console.error(e);
      } finally {
        setIsLoading(false);
      }
    },
    [api, index_type, state]
  );

  if (!isInitialized.current) {
    update({});
    isInitialized.current = true;
  }

  useEffect(() => {
    const indexTypeChanged = index_type !== prevIndexType.current;

    if (indexTypeChanged) {
      prevIndexType.current = index_type;
      update({ index_type });
    }
  }, [index_type, update]);

  const noMatchingContexts = useMemo(() => {
    return (
      state.dataVersionOptions.length > 0 &&
      state.dataVersionOptions.every((o) => o.isDisabled)
    );
  }, [state]);

  return {
    ...state,
    ...useCallbacks(update),
    isLoading,
    noMatchingContexts,
  };
}
