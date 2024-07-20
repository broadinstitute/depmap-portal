import {
  DataExplorerAggregation,
  DataExplorerDatasetDescriptor,
} from "@depmap/types";
import { contextsMatch, entityLabelFromContext } from "../../../utils/context";
import {
  computeOptions,
  filterDatasets,
  findHighestPriorityDatasetId,
  getEnabledDatasetIds,
} from "./utils";
import { Changes, EntityToDatasetsMapping, State } from "./types";
import { MismatchedEntityTypeError, UnknownDatasetError } from "./errors";

interface Props {
  changes: Changes;
  datasets: DataExplorerDatasetDescriptor[];
  entityMap: EntityToDatasetsMapping;
  contextLabels: Set<string>;
  prev: State;
}

export default function resolveNextState({
  changes,
  datasets,
  entityMap,
  contextLabels,
  prev,
}: Props) {
  const pd = prev.dimension;
  let dataType = prev.dataType;
  let units = prev.units;
  let entity_type = pd.entity_type;
  let context = pd.context;
  let dataset_id = pd.dataset_id;
  let axis_type = pd.axis_type;
  let aggregation = pd.aggregation;

  if ("aggregation" in changes && changes.aggregation) {
    aggregation = changes.aggregation as DataExplorerAggregation;
  }

  if ("index_type" in changes && !dataset_id) {
    dataType = null;
    entity_type = undefined;
    context = undefined;

    // FIXME: I think maybe none of this needed anymore.
    const dataTypes = new Set(
      datasets
        .filter((d) => d.index_type === changes.index_type)
        .map((d) => d.data_type)
    );

    const entityTypes = new Set(
      datasets
        .filter((d) => d.index_type === changes.index_type)
        .map((d) => d.entity_type)
    );

    if (entityTypes.size === 1) {
      entity_type = [...entityTypes][0];
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
      entity_type = undefined;
      dataset_id = undefined;
      context = undefined;
      units = null;
    } else {
      const entityTypes = new Set(
        filterDatasets(datasets, { dataType }).map((d) => d.entity_type)
      );

      if (!entity_type && entityTypes.size === 1) {
        entity_type = [...entityTypes][0];
      }
    }
  }

  if ("entity_type" in changes && entity_type !== changes.entity_type) {
    entity_type = changes.entity_type || undefined;

    if (entity_type !== context?.context_type) {
      context = undefined;
    }

    const dataTypes = new Set(
      filterDatasets(datasets, { entity_type }).map((d) => d.data_type)
    );

    if (!dataType && dataTypes.size === 1) {
      dataType = [...dataTypes][0];
    }
  }

  if (dataType !== prev.dataType || entity_type !== pd.entity_type) {
    units = null;
    dataset_id = undefined;

    const ds = filterDatasets(datasets, { entity_type, dataType });

    if (ds.length === 1) {
      dataset_id = ds[0].dataset_id;
    }
  }

  if ("axis_type" in changes && axis_type !== changes.axis_type) {
    axis_type = changes.axis_type || undefined;
    context = undefined;
    aggregation = axis_type === "entity" ? "first" : "mean";
  }

  if (
    "context" in changes &&
    !contextsMatch(context || null, changes.context || null)
  ) {
    context = changes.context || undefined;

    // See if we can infer a Data Type from an entity label alone.
    if (!dataType && axis_type === "entity") {
      const selectedLabel = entityLabelFromContext(context);

      const datasetIdsWithSelectedLabel = new Set(
        entityMap.dataset_ids.filter((id, index) => {
          if (!selectedLabel) {
            return false;
          }

          return entityMap.entity_labels[selectedLabel]?.includes(index);
        })
      );

      const enabledDataTypes = new Set(
        datasets
          .filter((d) => datasetIdsWithSelectedLabel.has(d.dataset_id))
          .map((d) => d.data_type)
      );

      if (enabledDataTypes.size === 1) {
        dataType = [...enabledDataTypes][0];
      }
    }
  }

  if ("dataset_id" in changes && dataset_id !== changes.dataset_id) {
    dataset_id = changes.dataset_id || undefined;
    const dataset = datasets.find((d) => d.dataset_id === dataset_id);

    if (dataset) {
      entity_type = dataset.entity_type;
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
    const dataset = datasets.find((d) => d.dataset_id === dataset_id);
    if (!dataset) {
      throw new UnknownDatasetError(`Unknown dataset_id "${dataset_id}"`);
    }

    if (entity_type && entity_type !== dataset.entity_type) {
      throw new MismatchedEntityTypeError(
        `entity_type "${entity_type}" does not match dataset_id "${dataset_id}"`
      );
    }
  }

  const hasAllRequiredProps = Boolean(dataType && entity_type && context);

  const requiredPropChanged =
    dataType !== prev.dataType ||
    entity_type !== pd.entity_type ||
    context !== pd.context;

  const unitsChanged = units && units !== prev.units;

  if (hasAllRequiredProps && (requiredPropChanged || unitsChanged)) {
    const enabledDatasetIds = getEnabledDatasetIds(
      datasets,
      entityMap,
      new Set(Object.keys(entityMap.entity_labels)),
      dataType,
      entity_type,
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
          entity_type,
          dataType,
          units
        );
      }
    }
  }

  // Initalize `dataType`  and `units` if we already know the `dataset_id`.
  // This needs to happen last, or it will trigger an auto-select which could
  // obscure an exceptional condition where an entity is now missing from the
  // selected dataset.
  if (!dataType && dataset_id) {
    const dataset = datasets.find((d) => d.dataset_id === dataset_id);

    if (!dataset) {
      throw new UnknownDatasetError(`Unknown dataset_id "${dataset_id}"`);
    }

    dataType = dataset.data_type;
  }

  let dirty =
    entity_type !== pd.entity_type ||
    dataset_id !== pd.dataset_id ||
    context !== pd.context ||
    axis_type !== pd.axis_type ||
    aggregation !== pd.aggregation;

  const options = computeOptions(
    datasets,
    entityMap,
    contextLabels,
    dataType,
    units,
    entity_type,
    axis_type,
    context
  );

  if (!dataType && options.dataTypeOptions.length === 1) {
    dataType = options.dataTypeOptions[0].value;
    dirty = true;
  }

  if (!entity_type && options.entityTypeOptions.length === 1) {
    entity_type = options.entityTypeOptions[0].value;
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
          entity_type,
          aggregation,
        }
      : prev.dimension,
  };
}
