import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DataExplorerPlotConfigDimension } from "@depmap/types";
import useData from "./useData";
import useCallbacks from "./useCallbacks";
import useSync from "./useSync";
import resolveNextState from "./resolveNextState";
import { handleError } from "./errors";
import {
  Changes,
  DimensionLabelsToDatasetsMapping,
  Mode,
  State,
  DEFAULT_STATE,
} from "./types";

interface Props {
  mode: Mode;
  index_type: string | null;
  value: Partial<DataExplorerPlotConfigDimension> | null;
  onChange: (nextValue: Partial<DataExplorerPlotConfigDimension>) => void;
  initialDataType?: string;
}

export default function useDimensionStateManager({
  mode,
  index_type,
  value,
  onChange,
  initialDataType = "",
}: Props) {
  const [state, setState] = useState<State>(() => {
    return {
      ...DEFAULT_STATE,
      dataType: initialDataType || null,
      dimension: value || {},
    };
  });

  // Keeps `value` and `state.dimension` in sync.
  useSync({ value, onChange, state, setState, mode });

  const { contextLabels, datasets, sliceMap, isLoading } = useData({
    index_type,
    slice_type: state.dimension.slice_type,
    axis_type: state.dimension.axis_type,
    context: state.dimension.context,
  });

  const update = useCallback(
    async (changes: Changes) => {
      if (isLoading) {
        return;
      }

      setState((prev) => {
        try {
          return resolveNextState({
            changes,
            datasets,
            sliceMap: sliceMap as DimensionLabelsToDatasetsMapping,
            contextLabels: contextLabels as Set<string>,
            prev,
          });
        } catch (error) {
          return handleError(error as Error, prev, changes, datasets);
        }
      });
    },
    [contextLabels, datasets, sliceMap, isLoading]
  );

  const prevIndexType = useRef(index_type);

  useEffect(() => {
    if (isLoading) {
      return;
    }

    const indexTypeChanged = index_type !== prevIndexType.current;
    update(indexTypeChanged ? { index_type } : {});
    prevIndexType.current = index_type;
  }, [datasets, isLoading, index_type, update]);

  const noMatchingContexts = useMemo(() => {
    return (
      !isLoading &&
      state.dataVersionOptions.length > 0 &&
      state.dataVersionOptions.every((o) => o.isDisabled)
    );
  }, [isLoading, state]);

  const isSingleCompound =
    state.dimension.slice_type === "compound_experiment" &&
    state.dimension.axis_type === "raw_slice";

  return {
    ...state,
    ...useCallbacks(update),
    isLoading,
    isSingleCompound,
    noMatchingContexts,
  };
}
