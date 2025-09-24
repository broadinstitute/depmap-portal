import { useCallback } from "react";
import { DataExplorerAggregation, DataExplorerContextV2 } from "@depmap/types";
import { Changes } from "./types";

type Update = (changes: Changes) => void;

export default function useCallbacks(update: Update) {
  const onChangeDataType = useCallback(
    (dataType: string | null) => {
      update({ dataType });
    },
    [update]
  );

  const onChangeUnits = useCallback(
    (units: string | null) => {
      update({ units });
    },
    [update]
  );

  const onChangeSliceType = useCallback(
    (slice_type: string | null) => {
      update({ slice_type });
    },
    [update]
  );

  const onChangeAxisType = useCallback(
    (axis_type: "raw_slice" | "aggregated_slice") => {
      update({ axis_type });
    },
    [update]
  );

  const onChangeDataVersion = useCallback(
    (dataset_id: string | null) => {
      update({ dataset_id });
    },
    [update]
  );

  const onChangeContext = useCallback(
    (context: DataExplorerContextV2 | null) => {
      update({ context });
    },
    [update]
  );

  const onChangeAggregation = useCallback(
    (aggregation: DataExplorerAggregation) => {
      update({ aggregation });
    },
    [update]
  );

  return {
    onChangeAggregation,
    onChangeAxisType,
    onChangeContext,
    onChangeDataType,
    onChangeDataVersion,
    onChangeSliceType,
    onChangeUnits,
  };
}
