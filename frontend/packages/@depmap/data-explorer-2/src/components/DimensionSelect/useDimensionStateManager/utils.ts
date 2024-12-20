import {
  DataExplorerContext,
  DataExplorerDatasetDescriptor,
} from "@depmap/types";
import { sliceLabelFromContext } from "../../../utils/context";
import {
  capitalize,
  getDimensionTypeLabel,
  isSampleType,
  pluralize,
  sortDimensionTypes,
} from "../../../utils/misc";
import { DimensionLabelsToDatasetsMapping } from "./types";

export function filterDatasets(
  datasets: DataExplorerDatasetDescriptor[],
  filters: {
    dataType?: string | null | undefined;
    slice_type?: string | null | undefined;
    units?: string | null | undefined;
  }
) {
  const { dataType, slice_type, units } = filters;

  return datasets
    .filter((d) => !dataType || d.data_type === dataType)
    .filter((d) => !slice_type || d.slice_type === slice_type)
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
  slice_type: string | undefined,
  dataType: string | null,
  units: string | null
) {
  let bestPriority = Infinity;
  let bestId: string | undefined;

  filterDatasets(datasets, { slice_type, dataType, units }).forEach((d) => {
    if (
      enabledDatasetIds.has(d.id) &&
      d.priority !== null &&
      d.priority < bestPriority
    ) {
      bestPriority = d.priority;
      bestId = d.id;
    }
  });

  return bestId;
}

export function getEnabledDatasetIds(
  datasets: DataExplorerDatasetDescriptor[],
  sliceLabelMap: DimensionLabelsToDatasetsMapping,
  contextLabels: Set<string>,
  dataType: string | null,
  slice_type: string | undefined,
  axis_type: "raw_slice" | "aggregated_slice" | undefined,
  context: DataExplorerContext | undefined,
  units?: string | null
) {
  if (!slice_type) {
    return new Set(
      datasets
        .filter((d) => !dataType || dataType === d.data_type)
        .map((d) => d.id)
    );
  }

  const enabledDatasetIds = new Set<string>();

  const validDsIndices = new Set(
    dataType ? sliceLabelMap.data_types[dataType] : datasets.map((_, i) => i)
  );

  if (units) {
    datasets
      .filter((d) => d.units !== units)
      .forEach((d) => {
        const index = sliceLabelMap.dataset_ids.findIndex((id) => id === d.id);
        validDsIndices.delete(index);
      });
  }

  const selectedLabel = sliceLabelFromContext(context);
  const labels = Object.keys(sliceLabelMap.dimension_labels);

  for (let i = 0; i < labels.length; i += 1) {
    const label = labels[i];
    const dsIndices = sliceLabelMap.dimension_labels[label];

    if (axis_type === "raw_slice" && context && selectedLabel !== label) {
      // eslint-disable-next-line no-continue
      continue;
    }

    if (
      axis_type === "aggregated_slice" &&
      context &&
      !contextLabels.has(label)
    ) {
      // eslint-disable-next-line no-continue
      continue;
    }

    for (let j = 0; j < dsIndices.length; j += 1) {
      const k = dsIndices[j];

      if (validDsIndices.has(k)) {
        const id = sliceLabelMap.dataset_ids[k];
        enabledDatasetIds.add(id);
      }
    }
  }

  return enabledDatasetIds;
}

export function computeOptions(
  datasets: DataExplorerDatasetDescriptor[],
  sliceLabelMap: DimensionLabelsToDatasetsMapping,
  contextLabels: Set<string>,
  selectedDataType: string | null,
  selectedUnits: string | null,
  selectedSliceType: string | undefined,
  selectedAxisType: "raw_slice" | "aggregated_slice" | undefined,
  selectedContext: DataExplorerContext | undefined
) {
  const enabledDatasetIds = getEnabledDatasetIds(
    datasets,
    sliceLabelMap,
    contextLabels,
    selectedDataType,
    selectedSliceType,
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
        sliceLabelMap,
        contextLabels,
        dataType, // <---
        selectedSliceType,
        selectedAxisType,
        selectedContext
      );

      if (idsForDataType.size === 0) {
        isDisabled = true;
        disabledOrder = 1;
        const entity = getDimensionTypeLabel(selectedSliceType as string);

        if (selectedAxisType === "aggregated_slice") {
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
        slice_type: selectedSliceType,
      });

      if (!entityDatasets.find((d) => d.data_type === dataType)) {
        isDisabled = true;
        disabledOrder = 2;

        disabledReason = [
          "The",
          isSampleType(selectedSliceType) ? "sample type" : "feature type",
          `“${capitalize(getDimensionTypeLabel(selectedSliceType as string))}”`,
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

  const sliceTypeOptions = sortDimensionTypes([
    ...new Set(datasets.map((d) => d.slice_type)),
  ])
    .map((slice_type) => {
      return {
        label: capitalize(getDimensionTypeLabel(slice_type)),
        value: slice_type,
        isDisabled: !filterDatasets(datasets, {
          dataType: selectedDataType,
        }).find((d) => d.slice_type === slice_type),
        disabledReason: [
          "The data type",
          `“${selectedDataType}”`,
          "is incompatible with this",
          isSampleType(selectedSliceType) ? "sample type" : "feature type",
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
        .some((d) => enabledDatasetIds.has(d.id));

      if (noEntities) {
        isDisabled = true;
        const entity = getDimensionTypeLabel(selectedSliceType as string);

        if (selectedAxisType === "aggregated_slice") {
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
        slice_type: selectedSliceType,
      });

      if (!entityDatasets.find((d) => d.units === units)) {
        isDisabled = true;

        const compatibleTypes = [
          ...new Set(
            filterDatasets(datasets, {
              units,
              dataType: selectedDataType,
            }).map(
              (d) => `“${capitalize(getDimensionTypeLabel(d.slice_type))}”`
            )
          ),
        ];

        if (compatibleTypes.length === 1) {
          disabledReason = [
            "This measure is only compatible with",
            isSampleType(selectedSliceType) ? "sample" : "feature",
            `type ${compatibleTypes[0]}`,
          ].join(" ");
        } else {
          disabledReason = [
            "This measure is only compatible with the following",
            isSampleType(selectedSliceType) ? "sample" : "feature",
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

  const highestPriorityDatasetId = findHighestPriorityDatasetId(
    datasets,
    enabledDatasetIds,
    selectedSliceType,
    selectedDataType,
    selectedUnits
  );

  const dataVersionOptions = filterDatasets(datasets, {
    dataType: selectedDataType,
  })
    .map((dataset) => {
      let isDisabled = false;
      let disabledReason = "";
      const entity = getDimensionTypeLabel(dataset.slice_type);

      if (selectedUnits && dataset.units !== selectedUnits) {
        isDisabled = true;
        disabledReason = [
          "This version is only compatible with the measure",
          `“${dataset.units}”`,
        ].join(" ");
      }

      if (selectedContext && !enabledDatasetIds.has(dataset.id)) {
        isDisabled = true;

        if (selectedAxisType === "aggregated_slice") {
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

      if (selectedSliceType && dataset.slice_type !== selectedSliceType) {
        isDisabled = true;

        disabledReason = [
          "This version is only compatible with",
          isSampleType(selectedSliceType) ? "sample" : "feature",
          `type “${capitalize(entity)}”`,
        ].join(" ");
      }

      return {
        label: dataset.name,
        value: dataset.id,
        isDefault: dataset.id === highestPriorityDatasetId,
        isDisabled,
        disabledReason,
      };
    })
    .sort(sortDisabledOptionsLast);

  return {
    dataTypeOptions,
    sliceTypeOptions,
    dataVersionOptions,
    unitsOptions,
  };
}
