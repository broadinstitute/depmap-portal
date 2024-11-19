import { DataExplorerAggregation } from "@depmap/types";
import { useDataExplorerApi } from "../../../contexts/DataExplorerApiContext";
import { contextsMatch } from "../../../utils/context";
import { Changes, State } from "./types";
import { inferDataType, inferSliceType } from "./utils";
import computeOptions from "./computeOptions";

async function resolveNextState(
  api: ReturnType<typeof useDataExplorerApi>,
  index_type: string | null,
  prev: State,
  changes: Changes
) {
  const pd = prev.dimension;
  let dataType = prev.dataType;
  let units = prev.units;
  let slice_type = pd.slice_type;
  let context = pd.context;
  let dataset_id = pd.dataset_id;
  let axis_type = pd.axis_type;
  let aggregation = pd.aggregation;

  if ("aggregation" in changes && changes.aggregation) {
    aggregation = changes.aggregation as DataExplorerAggregation;
  }

  if ("index_type" in changes && !dataset_id) {
    dataType = null;
    slice_type = undefined;
    context = undefined;
  }

  if ("dataType" in changes && dataType !== changes.dataType) {
    dataType = changes.dataType || null;
    dataset_id = undefined;

    if (
      dataType === null &&
      prev.dataTypeOptions.filter((o) => !o.isDisabled).length === 1
    ) {
      slice_type = undefined;
      dataset_id = undefined;
      context = undefined;
      units = null;
    } else if (!slice_type) {
      slice_type = await inferSliceType(api, index_type, dataType);
    }
  }

  if ("slice_type" in changes && slice_type !== changes.slice_type) {
    slice_type = changes.slice_type || undefined;

    if (slice_type !== context?.dimension_type) {
      context = undefined;
    }

    if (slice_type && !dataType) {
      dataType = await inferDataType(api, index_type, slice_type);
    }
  }

  if (dataType !== prev.dataType || slice_type !== pd.slice_type) {
    units = null;
    dataset_id = undefined;

    // TODO: Try to infer `dataset_id`
  }

  if ("axis_type" in changes && axis_type !== changes.axis_type) {
    axis_type = changes.axis_type || undefined;
    context = undefined;
    aggregation = axis_type === "raw_slice" ? "first" : "mean";
  }

  if (
    "context" in changes &&
    !contextsMatch(context || null, changes.context || null)
  ) {
    context = changes.context || undefined;

    // See if we can infer a Data Type from a feature/sample id alone.
    if (!dataType && axis_type === "raw_slice") {
      // FIXME: Figure out how to calcuate this from the selected `context`.
      const enabledDataTypes = new Set<string>();

      if (enabledDataTypes.size === 1) {
        dataType = [...enabledDataTypes][0];
      }
    }
  }

  if ("dataset_id" in changes && dataset_id !== changes.dataset_id) {
    dataset_id = changes.dataset_id || undefined;

    // TODO: set `slice_type` and `dataType` to that of the underlying dataset.
  }

  if ("units" in changes && units !== changes.units) {
    units = changes.units || null;

    if (
      units &&
      prev.dataVersionOptions.filter((o) => !o.isDisabled).length > 1
    ) {
      dataset_id = undefined;
    }
  }

  const hasAllRequiredProps = Boolean(dataType && slice_type && context);

  const requiredPropChanged =
    dataType !== prev.dataType ||
    slice_type !== pd.slice_type ||
    context !== pd.context;

  const unitsChanged = units && units !== prev.units;

  if (hasAllRequiredProps && (requiredPropChanged || unitsChanged)) {
    // TODO: Set `dataset_id` to the highest priority dataset available.
  }

  // Initalize `dataType` if we already know the `dataset_id`. This needs to
  // happen last.
  if (!dataType && dataset_id) {
    // TODO: Set `dataType` by looking up the dataset.
  }

  let dirty =
    slice_type !== pd.slice_type ||
    dataset_id !== pd.dataset_id ||
    context !== pd.context ||
    axis_type !== pd.axis_type ||
    aggregation !== pd.aggregation;

  const options = await computeOptions(api, index_type, dataType, {
    ...prev.dimension,
    axis_type,
    context,
    dataset_id,
    slice_type,
    aggregation,
  });

  if (!dataType && options.dataTypeOptions.length === 1) {
    dataType = options.dataTypeOptions[0].value;
    dirty = true;
  }

  if (!slice_type && options.sliceTypeOptions.length === 1) {
    slice_type = options.sliceTypeOptions[0].value;
    dirty = true;
  }

  if (!dataset_id && options.dataVersionOptions.length === 1) {
    dataset_id = options.dataVersionOptions[0].value;
    dirty = true;
  }

  return {
    ...prev,
    ...options,
    dataType,
    units,
    dirty,
    dimension: dirty
      ? {
          ...prev.dimension,
          axis_type,
          context,
          dataset_id,
          slice_type,
          aggregation,
        }
      : prev.dimension,
  };
}

export default resolveNextState;
