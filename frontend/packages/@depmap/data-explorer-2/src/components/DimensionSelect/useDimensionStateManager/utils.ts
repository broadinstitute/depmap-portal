import {
  DataExplorerContext,
  DataExplorerDatasetDescriptor,
} from "@depmap/types";
import { entityLabelFromContext } from "../../../utils/context";
import {
  capitalize,
  getDimensionTypeLabel,
  isSampleType,
  pluralize,
  sortDimensionTypes,
} from "../../../utils/misc";
import { EntityToDatasetsMapping } from "./types";

export function filterDatasets(
  datasets: DataExplorerDatasetDescriptor[],
  filters: {
    dataType?: string | null | undefined;
    entity_type?: string | null | undefined;
    units?: string | null | undefined;
  }
) {
  const { dataType, entity_type, units } = filters;

  return datasets
    .filter((d) => !dataType || d.data_type === dataType)
    .filter((d) => !entity_type || d.entity_type === entity_type)
    .filter((d) => !units || d.units === units);
}

export function sortDisabledOptionsLast(
  a: { label: string; isDisabled: boolean },
  b: { label: string; isDisabled: boolean }
) {
  if (!a.isDisabled && !b.isDisabled) {
    return 0;
  }

  if (a.isDisabled && b.isDisabled) {
    return a.label.toLowerCase() < b.label.toLowerCase() ? -1 : 1;
  }

  return a.isDisabled ? 1 : -1;
}

export function findHighestPriorityDatasetId(
  datasets: DataExplorerDatasetDescriptor[],
  enabledDatasetIds: Set<string>,
  entity_type: string | undefined,
  dataType: string | null,
  units: string | null
) {
  let bestPriority = Infinity;
  let bestId: string | undefined;

  filterDatasets(datasets, { entity_type, dataType, units }).forEach((d) => {
    if (
      enabledDatasetIds.has(d.dataset_id) &&
      d.priority !== null &&
      d.priority < bestPriority
    ) {
      bestPriority = d.priority;
      bestId = d.dataset_id;
    }
  });

  return bestId;
}

function isHighestPriorityDataset(
  dataset: DataExplorerDatasetDescriptor,
  datasets: DataExplorerDatasetDescriptor[],
  enabledDatasetIds: Set<string>,
  entity_type: string | undefined,
  dataType: string | null,
  units: string | null
) {
  const bestId = findHighestPriorityDatasetId(
    datasets,
    enabledDatasetIds,
    entity_type,
    dataType,
    units
  );

  return dataset.dataset_id === bestId;
}

export function getEnabledDatasetIds(
  datasets: DataExplorerDatasetDescriptor[],
  entityLabelMap: EntityToDatasetsMapping,
  contextLabels: Set<string>,
  dataType: string | null,
  entity_type: string | undefined,
  axis_type: "entity" | "context" | undefined,
  context: DataExplorerContext | undefined,
  units?: string | null
) {
  if (!entity_type) {
    return new Set(
      datasets
        .filter((d) => !dataType || dataType === d.data_type)
        .map((d) => d.dataset_id)
    );
  }

  const enabledDatasetIds = new Set<string>();

  const validDsIndices = new Set(
    dataType ? entityLabelMap.data_types[dataType] : datasets.map((_, i) => i)
  );

  if (units) {
    datasets
      .filter((d) => d.units !== units)
      .forEach((d) => {
        const index = entityLabelMap.dataset_ids.findIndex(
          (id) => id === d.dataset_id
        );
        validDsIndices.delete(index);
      });
  }

  const selectedLabel = entityLabelFromContext(context);
  const labels = Object.keys(entityLabelMap.entity_labels);

  for (let i = 0; i < labels.length; i += 1) {
    const label = labels[i];
    const dsIndices = entityLabelMap.entity_labels[label];

    if (axis_type === "entity" && context && selectedLabel !== label) {
      // eslint-disable-next-line no-continue
      continue;
    }

    if (axis_type === "context" && context && !contextLabels.has(label)) {
      // eslint-disable-next-line no-continue
      continue;
    }

    for (let j = 0; j < dsIndices.length; j += 1) {
      const k = dsIndices[j];

      if (validDsIndices.has(k)) {
        const id = entityLabelMap.dataset_ids[k];
        enabledDatasetIds.add(id);
      }
    }
  }

  return enabledDatasetIds;
}

export function computeOptions(
  datasets: DataExplorerDatasetDescriptor[],
  entityLabelMap: EntityToDatasetsMapping,
  contextLabels: Set<string>,
  selectedDataType: string | null,
  selectedUnits: string | null,
  selectedEntityType: string | undefined,
  selectedAxisType: "entity" | "context" | undefined,
  selectedContext: DataExplorerContext | undefined
) {
  const enabledDatasetIds = getEnabledDatasetIds(
    datasets,
    entityLabelMap,
    contextLabels,
    selectedDataType,
    selectedEntityType,
    selectedAxisType,
    selectedContext
  );

  const formattedlabel = selectedContext?.name || "";

  const dataTypeOptions = [...new Set(datasets.map((d) => d.data_type))]
    .sort((a, b) => (a.toLowerCase() < b.toLowerCase() ? -1 : 1))
    .map((dataType) => {
      let isDisabled = false;
      let disabledReason = "";
      let disabledOrder = 0;

      const idsForDataType = getEnabledDatasetIds(
        datasets,
        entityLabelMap,
        contextLabels,
        dataType, // <---
        selectedEntityType,
        selectedAxisType,
        selectedContext
      );

      if (idsForDataType.size === 0) {
        isDisabled = true;
        disabledOrder = 1;
        const entity = getDimensionTypeLabel(selectedEntityType as string);

        if (selectedAxisType === "context") {
          disabledReason = [
            `The context “${formattedlabel}”`,
            `has no ${pluralize(entity)} associated with this type`,
          ].join(" ");
        } else {
          disabledReason = [
            `The ${entity} “${formattedlabel}”`,
            "is not found in any data versions associated with this type",
          ].join(" ");
        }
      }

      const entityDatasets = filterDatasets(datasets, {
        entity_type: selectedEntityType,
      });

      if (!entityDatasets.find((d) => d.data_type === dataType)) {
        isDisabled = true;
        disabledOrder = 2;

        disabledReason = [
          "The",
          isSampleType(selectedEntityType) ? "sample type" : "feature type",
          `“${capitalize(
            getDimensionTypeLabel(selectedEntityType as string)
          )}”`,
          "is incompatible with this data type",
        ].join(" ");
      }

      return {
        label: dataType,
        value: dataType,
        isDisabled,
        disabledReason,
        disabledOrder,
      };
    })
    .sort(sortDisabledOptionsLast)
    .sort((a, b) => {
      if (a.disabledOrder === b.disabledOrder) {
        return 0;
      }

      return a.disabledOrder < b.disabledOrder ? -1 : 1;
    });

  const entityTypeOptions = sortDimensionTypes([
    ...new Set(datasets.map((d) => d.entity_type)),
  ])
    .map((entity_type) => {
      return {
        label: capitalize(getDimensionTypeLabel(entity_type)),
        value: entity_type,
        isDisabled: !filterDatasets(datasets, {
          dataType: selectedDataType,
        }).find((d) => d.entity_type === entity_type),
        disabledReason: [
          "The data type",
          `“${selectedDataType}”`,
          "is incompatible with this",
          isSampleType(selectedEntityType) ? "sample type" : "feature type",
        ].join(" "),
      };
    })
    .sort(sortDisabledOptionsLast);

  const unitsOptions = [
    ...new Set(
      datasets
        .filter((d) => d.data_type === selectedDataType)
        .map((d) => d.units)
    ),
  ]
    .sort((a, b) => (a.toLowerCase() < b.toLowerCase() ? -1 : 1))
    .map((units) => {
      let isDisabled = false;
      let disabledReason = "";

      const noEntities = !datasets
        .filter((d) => d.units === units)
        .some((d) => enabledDatasetIds.has(d.dataset_id));

      if (noEntities) {
        isDisabled = true;
        const entity = getDimensionTypeLabel(selectedEntityType as string);

        if (selectedAxisType === "context") {
          disabledReason = [
            `The context “${formattedlabel}”`,
            `has no ${pluralize(entity)}`,
            "with this measurement",
          ].join(" ");
        } else {
          disabledReason = [
            `The ${entity} “${formattedlabel}”`,
            `has no “${units}” measurement`,
          ].join(" ");
        }
      }

      const entityDatasets = filterDatasets(datasets, {
        dataType: selectedDataType,
        entity_type: selectedEntityType,
      });

      if (!entityDatasets.find((d) => d.units === units)) {
        isDisabled = true;

        const compatibleTypes = [
          ...new Set(
            filterDatasets(datasets, {
              units,
              dataType: selectedDataType,
            }).map(
              (d) => `“${capitalize(getDimensionTypeLabel(d.entity_type))}”`
            )
          ),
        ];

        if (compatibleTypes.length === 1) {
          disabledReason = [
            "This measure is only compatible with",
            isSampleType(selectedEntityType) ? "sample" : "feature",
            `type ${compatibleTypes[0]}`,
          ].join(" ");
        } else {
          disabledReason = [
            "This measure is only compatible with the following",
            isSampleType(selectedEntityType) ? "sample" : "feature",
            `types: ${compatibleTypes.join(", ")}`,
          ].join(" ");
        }
      }

      return {
        label: units,
        value: units,
        isDisabled,
        disabledReason,
      };
    })
    .sort(sortDisabledOptionsLast);

  const dataVersionOptions = filterDatasets(datasets, {
    dataType: selectedDataType,
  })
    .map((dataset) => {
      let isDisabled = false;
      let disabledReason = "";
      const entity = getDimensionTypeLabel(dataset.entity_type);

      if (selectedUnits && dataset.units !== selectedUnits) {
        isDisabled = true;
        disabledReason = [
          "This version is only compatible with the measure",
          `“${dataset.units}”`,
        ].join(" ");
      }

      if (selectedContext && !enabledDatasetIds.has(dataset.dataset_id)) {
        isDisabled = true;

        if (selectedAxisType === "context") {
          disabledReason = [
            `The context “${formattedlabel}”`,
            `has no ${pluralize(entity)}`,
            "found in this version",
          ].join(" ");
        } else {
          disabledReason = [
            `The ${entity} “${formattedlabel}”`,
            "is not found in this version",
          ].join(" ");
        }
      }

      if (selectedEntityType && dataset.entity_type !== selectedEntityType) {
        isDisabled = true;

        disabledReason = [
          "This version is only compatible with",
          isSampleType(selectedEntityType) ? "sample" : "feature",
          `type “${capitalize(entity)}”`,
        ].join(" ");
      }

      return {
        label: dataset.label,
        value: dataset.dataset_id,
        isDefault: isHighestPriorityDataset(
          dataset,
          datasets,
          enabledDatasetIds,
          selectedEntityType,
          selectedDataType,
          selectedUnits
        ),
        isDisabled,
        disabledReason,
      };
    })
    .sort(sortDisabledOptionsLast);

  return {
    dataTypeOptions,
    entityTypeOptions,
    dataVersionOptions,
    unitsOptions,
  };
}
