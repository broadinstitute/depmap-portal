import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DataExplorerPlotConfigDimensionV2 } from "@depmap/types";
import useCallbacks from "./useCallbacks";
import useSync from "./useSync";
import resolveNextState from "./resolveNextState";
import { findDataType } from "./utils";
import { Changes, Mode, State, DEFAULT_STATE } from "./types";

interface Props {
  mode: Mode;
  index_type: string | null;
  value: Partial<DataExplorerPlotConfigDimensionV2> | null;
  onChange: (nextValue: Partial<DataExplorerPlotConfigDimensionV2>) => void;
  allowNullFeatureType: boolean;
  valueTypes: Set<"continuous" | "text" | "categorical" | "list_strings">;
  initialDataType?: string;
}

export default function useDimensionStateManager({
  mode,
  index_type,
  value,
  onChange,
  allowNullFeatureType,
  valueTypes,
  initialDataType = "",
}: Props) {
  const isInitialized = useRef(false);
  const [isLoading, setIsLoading] = useState(true);

  const prevIndexType = useRef(index_type);
  const prevContext = useRef(value?.context);

  const initialState = useRef({
    ...DEFAULT_STATE,
    dataType: initialDataType || null,
    allowNullFeatureType,
    valueTypes,
    dimension: {
      ...value,

      axis_type:
        value?.axis_type ||
        (mode === "context-only"
          ? ("aggregated_slice" as const)
          : ("raw_slice" as const)),

      aggregation:
        value?.aggregation ||
        (mode === "context-only" ? undefined : ("first" as const)),
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
          index_type,
          state,
          changes,
          false
        );
        setState(nextState);

        const nextStateWithOptions = await resolveNextState(
          index_type,
          state,
          changes,
          true
        );
        setState(nextStateWithOptions);
      } catch (e) {
        window.console.error(e);
      } finally {
        setIsLoading(false);
      }
    },
    [index_type, state]
  );

  if (!isInitialized.current) {
    update({});
    isInitialized.current = true;
  }

  useEffect(() => {
    const indexTypeChanged = index_type !== prevIndexType.current;

    if (indexTypeChanged) {
      prevIndexType.current = index_type;
      update({
        index_type,
        axis_type:
          mode === "context-only"
            ? ("aggregated_slice" as const)
            : ("raw_slice" as const),

        aggregation: mode === "context-only" ? undefined : ("first" as const),
      });
    }
  }, [index_type, mode, update]);

  useEffect(() => {
    if (state.isUnknownDataset) {
      return;
    }

    const dataset_id = state.dimension.dataset_id;

    if (state.dataType === null && dataset_id !== undefined) {
      findDataType(index_type, dataset_id).then((dataType) => {
        if (dataType) {
          // HACK: We must also update dataset_id or this causes an infinte
          // loop!
          update({ dataType, dataset_id });
        } else {
          update({ isUnknownDataset: true });
        }
      });
    }
  }, [
    index_type,
    state.dataType,
    state.dimension.dataset_id,
    state.isUnknownDataset,
    update,
  ]);

  useEffect(() => {
    // Handles the case where the context is cleared and we need to re-compute
    // options.
    if (prevContext.current && !state.dimension.context) {
      update({ context: undefined });
    }

    prevContext.current = state.dimension.context;
  }, [state.dimension.context, update]);

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
