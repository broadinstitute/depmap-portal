import { DataExplorerAggregation } from "@depmap/types";
import { contextsMatch } from "../../../utils/context";
import { Changes, State } from "./types";
import {
  inferDataType,
  inferDatasetId,
  inferSliceType,
  inferTypesFromDatasetId,
} from "./utils";
import computeOptions, { computeUnitsOptions } from "./computeOptions";

async function resolveNextState(
  index_type: string | null,
  prev: State,
  changes: Changes,
  shouldCalcOptions: boolean
) {
  const pd = prev.dimension;
  let dataType = prev.dataType;
  let units = prev.units;
  let slice_type = pd.slice_type;
  let context = pd.context;
  let dataset_id = pd.dataset_id;
  let axis_type = pd.axis_type;
  let aggregation = pd.aggregation;
  let isUnknownDataset = prev.isUnknownDataset;

  if ("isUnknownDataset" in changes) {
    isUnknownDataset = changes.isUnknownDataset as boolean;
  }

  if ("aggregation" in changes && changes.aggregation) {
    aggregation = changes.aggregation as DataExplorerAggregation;
  }

  if ("index_type" in changes) {
    dataType = null;
    units = null;
    slice_type = undefined;
    context = undefined;
    dataset_id = undefined;
  }

  if ("dataType" in changes && dataType !== changes.dataType) {
    dataType = changes.dataType || null;
    dataset_id = undefined;
    isUnknownDataset = false;

    if (
      dataType === null &&
      prev.dataTypeOptions.filter((o) => !o.isDisabled).length === 1
    ) {
      slice_type = undefined;
      dataset_id = undefined;
      context = undefined;
      units = null;
    } else if (!slice_type) {
      const inferred = await inferSliceType(
        index_type,
        dataType,
        dataset_id || null
      );
      slice_type = inferred?.valueOf();
    }
  }

  if ("slice_type" in changes && slice_type !== changes.slice_type) {
    slice_type =
      changes.slice_type === undefined
        ? undefined
        : changes.slice_type.valueOf();

    if (slice_type !== context?.dimension_type) {
      context = undefined;
    }

    if (changes.slice_type && !dataType) {
      dataType = await inferDataType(
        index_type,
        changes.slice_type,
        dataset_id || null
      );
    }
  }

  if (dataType !== prev.dataType || slice_type !== pd.slice_type) {
    units = null;
    dataset_id = undefined;
    isUnknownDataset = false;

    if (dataType && slice_type) {
      dataset_id = await inferDatasetId(
        index_type,
        slice_type,
        dataType,
        dataset_id || null
      );
    }
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
    isUnknownDataset = false;

    if (dataset_id) {
      const {
        inferredSliceType,
        inferredDataType,
      } = await inferTypesFromDatasetId(index_type, dataset_id);

      slice_type = inferredSliceType?.valueOf();
      dataType = inferredDataType;
    } else if (slice_type === null) {
      slice_type = undefined;
      context = undefined;
    }
  }

  if ("units" in changes && units !== changes.units) {
    units = changes.units || null;
  }

  const options = shouldCalcOptions
    ? await computeOptions(
        index_type,
        dataType,
        units,
        prev.allowNullFeatureType,
        prev.valueTypes,
        {
          ...prev.dimension,
          axis_type,
          context,
          dataset_id,
          slice_type,
          aggregation,
        }
      )
    : {
        dataVersionOptions: [],
        dataTypeOptions: [],
        sliceTypeOptions: [],
        unitsOptions: [],
      };

  const hasAllRequiredProps = Boolean(dataType && slice_type && context);

  const requiredPropChanged =
    dataType !== prev.dataType ||
    slice_type !== pd.slice_type ||
    context !== pd.context;

  if (!dataset_id && hasAllRequiredProps && requiredPropChanged) {
    const defaultDatasetOption = options.dataVersionOptions.find(
      (d) => d.isDefault
    );

    if (defaultDatasetOption) {
      dataset_id = defaultDatasetOption.value;
      isUnknownDataset = false;
    }
  }

  const unitsChanged = units && units !== prev.units;

  if (unitsChanged) {
    const defaultDatasetOption = options.dataVersionOptions.find(
      (d) => d.isDefault
    );

    if (defaultDatasetOption) {
      dataset_id = defaultDatasetOption.value;
      isUnknownDataset = false;

      const {
        inferredSliceType,
        inferredDataType,
      } = await inferTypesFromDatasetId(index_type, dataset_id);

      slice_type = inferredSliceType?.valueOf();
      dataType = inferredDataType;

      // recompute units options now that we've updated slice_type and dataType.
      options.unitsOptions = await computeUnitsOptions(
        index_type,
        dataType,
        prev.valueTypes,
        prev.allowNullFeatureType,
        {
          ...prev.dimension,
          axis_type,
          context,
          dataset_id,
          slice_type,
          aggregation,
        }
      );
    } else if (slice_type === null) {
      slice_type = undefined;
      context = undefined;
    } else {
      dataset_id = undefined;
    }
  }

  if (!dataType && options.dataTypeOptions.length === 1) {
    dataType = options.dataTypeOptions[0].value;
  }

  if (!slice_type && options.sliceTypeOptions.length === 1) {
    slice_type = options.sliceTypeOptions[0].value.valueOf();
  }

  if (!dataset_id && options.dataVersionOptions.length === 1) {
    dataset_id = options.dataVersionOptions[0].value;
  }

  if (!prev.dimension.slice_type && slice_type && !dataType) {
    const enabledOpts = options.dataTypeOptions.filter((o) => !o.isDisabled);
    if (enabledOpts.length === 1) {
      dataType = enabledOpts[0].value;
    }
  }

  if (!prev.dataType && dataType && !slice_type) {
    const enabledOpts = options.sliceTypeOptions.filter((o) => !o.isDisabled);
    if (enabledOpts.length === 1) {
      slice_type = enabledOpts[0].value.valueOf();
    }
  }

  if (!prev.dimension.context && context && !dataset_id) {
    const enabledOpts = options.dataVersionOptions.filter((o) => !o.isDisabled);
    if (enabledOpts.length === 1) {
      dataset_id = enabledOpts[0].value;
    }
  }

  const dirty =
    slice_type !== pd.slice_type ||
    dataset_id !== pd.dataset_id ||
    context !== pd.context ||
    axis_type !== pd.axis_type ||
    aggregation !== pd.aggregation;

  return {
    ...prev,
    ...options,
    dataType,
    units,
    dirty,
    isUnknownDataset,
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
