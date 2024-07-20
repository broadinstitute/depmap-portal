import { useEffect } from "react";
import { DataExplorerPlotConfigDimension } from "@depmap/types";
import { State } from "./types";

interface Props {
  value: Partial<DataExplorerPlotConfigDimension> | null;
  onChange: (nextValue: Partial<DataExplorerPlotConfigDimension>) => void;
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
      setState((prev) => ({ ...prev, dirty: false, justSynced: true }));
      onChange(state.dimension);
    }
  }, [state.dirty, state.dimension, onChange, setState]);

  useEffect(() => {
    setState((prev) => {
      if (prev.justSynced) {
        return { ...prev, justSynced: false };
      }

      if (prev.dirty || !value) {
        return prev;
      }

      let axis_type = value.axis_type || prev.dimension.axis_type;
      let aggregation =
        value.aggregation || prev.dimension.aggregation || "first";

      if (!axis_type || mode === "entity-only") {
        axis_type = "entity";
        aggregation = "first";
      }

      if (mode === "context-only") {
        axis_type = "context";

        if (aggregation !== "correlation") {
          aggregation = "mean";
        }
      }

      // Force `dataType` to be re-initialized when dataset_id changes
      const dataType =
        value.dataset_id === prev.dimension.dataset_id ? prev.dataType : null;

      return {
        ...prev,
        dataType,
        dimension: {
          ...value,
          axis_type,
          aggregation,
        },
      };
    });
  }, [value, mode, setState]);
}
