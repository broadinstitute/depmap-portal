import { useEffect } from "react";
import { DataExplorerPlotConfigDimensionV2 } from "@depmap/types";
import { State } from "./types";

interface Props {
  value: Partial<DataExplorerPlotConfigDimensionV2> | null;
  onChange: (nextValue: Partial<DataExplorerPlotConfigDimensionV2>) => void;
  state: State;
  setState: React.Dispatch<React.SetStateAction<State>>;
  mode: "entity-only" | "context-only" | "entity-or-context";
}

export default function useSync({
  value,
  onChange,
  state,
  setState,
  mode,
}: Props) {
  useEffect(() => {
    if (state.dirty) {
      setState((prev) => ({ ...prev, dirty: false, needsSync: true }));
    }
    // eslint-disable-next-line
  }, [state.dirty]);

  useEffect(() => {
    if (state.needsSync) {
      onChange(state.dimension);
      setState((prev) => ({ ...prev, needsSync: false }));
    }
    // eslint-disable-next-line
  }, [state.needsSync]);

  useEffect(() => {
    setState((prev) => {
      if (prev.dirty) {
        return prev;
      }

      if (prev.needsSync) {
        return prev;
      }

      let axis_type = value?.axis_type || prev.dimension.axis_type;
      let aggregation =
        value?.aggregation || prev.dimension.aggregation || "first";

      if (!axis_type || mode === "entity-only") {
        axis_type = "raw_slice";
        aggregation = "first";
      }

      if (mode === "context-only") {
        axis_type = "aggregated_slice";

        if (aggregation !== "correlation") {
          aggregation = "mean";
        }
      }

      // Force `dataType` to be re-initialized when dataset_id changes
      const dataType =
        value?.dataset_id === prev.dimension.dataset_id ? prev.dataType : null;

      // Also force `isUnknownDataset` to be re-initialized when dataset_id changes
      const isUnknownDataset =
        value?.dataset_id === prev.dimension.dataset_id
          ? prev.isUnknownDataset
          : false;

      return {
        ...prev,
        dataType,
        isUnknownDataset,
        dimension: {
          ...value,
          axis_type,
          aggregation,
        },
      };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);
}
