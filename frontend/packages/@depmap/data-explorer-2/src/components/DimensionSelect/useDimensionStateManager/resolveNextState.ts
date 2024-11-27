import {
  DataExplorerAggregation,
  DataExplorerDatasetDescriptor,
} from "@depmap/types";
import { contextsMatch, sliceLabelFromContext } from "../../../utils/context";
import {
  computeOptions,
  filterDatasets,
  findHighestPriorityDatasetId,
  getEnabledDatasetIds,
} from "./utils";
import { Changes, DimensionLabelsToDatasetsMapping, State } from "./types";
import { MismatchedSliceTypeError, UnknownDatasetError } from "./errors";

interface Props {
  changes: Changes;
  datasets: DataExplorerDatasetDescriptor[];
  sliceMap: DimensionLabelsToDatasetsMapping;
  contextLabels: Set<string>;
  prev: State;
}

export default function resolveNextState({
  changes,
  datasets,
  sliceMap,
  contextLabels,
  prev,
}: Props) {
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

    // FIXME: I think maybe none of this needed anymore.
    const dataTypes = new Set(
      datasets
        .filter((d) => d.index_type === changes.index_type)
        .map((d) => d.data_type)
    );

    const sliceTypes = new Set(
      datasets
        .filter((d) => d.index_type === changes.index_type)
        .map((d) => d.slice_type)
    );

    if (sliceTypes.size === 1) {
      slice_type = [...sliceTypes][0];
    }

    if (dataTypes.size === 1) {
      dataType = [...dataTypes][0];
    }
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
    } else {
      const sliceTypes = new Set(
        filterDatasets(datasets, { dataType }).map((d) => d.slice_type)
      );

      if (!slice_type && sliceTypes.size === 1) {
        slice_type = [...sliceTypes][0];
      }
    }
  }

  if ("slice_type" in changes && slice_type !== changes.slice_type) {
    slice_type = changes.slice_type || undefined;

    if (slice_type !== context?.context_type) {
      context = undefined;
    }

    const dataTypes = new Set(
      filterDatasets(datasets, { slice_type }).map((d) => d.data_type)
    );

    if (!dataType && dataTypes.size === 1) {
      dataType = [...dataTypes][0];
    }
  }

  if (dataType !== prev.dataType || slice_type !== pd.slice_type) {
    units = null;
    dataset_id = undefined;

    const ds = filterDatasets(datasets, { slice_type, dataType });

    if (ds.length === 1) {
      dataset_id = ds[0].id;
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

    // See if we can infer a Data Type from a slice label alone.
    if (!dataType && axis_type === "raw_slice") {
      const selectedLabel = sliceLabelFromContext(context);

      const datasetIdsWithSelectedLabel = new Set(
        sliceMap.dataset_ids.filter((id, index) => {
          if (!selectedLabel) {
            return false;
          }

          return sliceMap.dimension_labels[selectedLabel]?.includes(index);
        })
      );

      const enabledDataTypes = new Set(
        datasets
          .filter((d) => datasetIdsWithSelectedLabel.has(d.id))
          .map((d) => d.data_type)
      );

      if (enabledDataTypes.size === 1) {
        dataType = [...enabledDataTypes][0];
      }
    }
  }

  if ("dataset_id" in changes && dataset_id !== changes.dataset_id) {
    dataset_id = changes.dataset_id || undefined;
    const dataset = datasets.find((d) => d.id === dataset_id);

    if (dataset) {
      slice_type = dataset.slice_type;
      dataType = dataset.data_type;
    }
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

  if (dataset_id) {
    const dataset = datasets.find((d) => d.id === dataset_id);
    if (!dataset) {
      throw new UnknownDatasetError(`Unknown dataset_id "${dataset_id}"`);
    }

    if (slice_type && slice_type !== dataset.slice_type) {
      throw new MismatchedSliceTypeError(
        `slice_type "${slice_type}" does not match dataset_id "${dataset_id}"`
      );
    }
  }

  const hasAllRequiredProps = Boolean(dataType && slice_type && context);

  const requiredPropChanged =
    dataType !== prev.dataType ||
    slice_type !== pd.slice_type ||
    context !== pd.context;

  const unitsChanged = units && units !== prev.units;

  if (hasAllRequiredProps && (requiredPropChanged || unitsChanged)) {
    const enabledDatasetIds = getEnabledDatasetIds(
      datasets,
      sliceMap,
      new Set(Object.keys(sliceMap.dimension_labels)),
      dataType,
      slice_type,
      axis_type,
      context,
      units
    );

    if (!dataset_id || !enabledDatasetIds.has(dataset_id)) {
      if (enabledDatasetIds.size === 1) {
        dataset_id = [...enabledDatasetIds][0];
      } else {
        dataset_id = findHighestPriorityDatasetId(
          datasets,
          enabledDatasetIds,
          slice_type,
          dataType,
          units
        );
      }
    }
  }

  // Initalize `dataType` and `units` if we already know the `dataset_id`. This
  // needs to happen last, or it will trigger an auto-select which could
  // obscure an exceptional condition where a slice label is now missing from
  // the selected dataset.
  if (!dataType && dataset_id) {
    const dataset = datasets.find((d) => d.id === dataset_id);

    if (!dataset) {
      throw new UnknownDatasetError(`Unknown dataset_id "${dataset_id}"`);
    }

    dataType = dataset.data_type;
  }

  let dirty =
    slice_type !== pd.slice_type ||
    dataset_id !== pd.dataset_id ||
    context !== pd.context ||
    axis_type !== pd.axis_type ||
    aggregation !== pd.aggregation;

  const options = computeOptions(
    datasets,
    sliceMap,
    contextLabels,
    dataType,
    units,
    slice_type,
    axis_type,
    context
  );

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
