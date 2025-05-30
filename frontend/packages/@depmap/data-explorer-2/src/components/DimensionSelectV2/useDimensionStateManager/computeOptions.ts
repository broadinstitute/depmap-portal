import { compareCaseInsensitive, compareDisabledLast } from "@depmap/utils";
import { useDataExplorerApi } from "../../../contexts/DataExplorerApiContext";
import { isSampleType, pluralize } from "../../../utils/misc";
import { State } from "./types";
import { fetchDatasetsByIndexType } from "./utils";

async function fetchIndexCompatibleDatasets(
  api: ReturnType<typeof useDataExplorerApi>,
  index_type: string | null
) {
  const datasets = await fetchDatasetsByIndexType(api);

  if (!index_type || !(index_type in datasets)) {
    return [];
  }

  if (!(index_type in datasets)) {
    throw new Error(`Unknown dimension type "${index_type}".`);
  }

  return datasets[index_type];
}

async function fetchContextCompatibleDatasets(
  api: ReturnType<typeof useDataExplorerApi>,
  dimension: State["dimension"]
) {
  if (!dimension.context) {
    return null;
  }

  const expr = dimension.context.expr;

  const dimensionTypes = await api.fetchDimensionTypes();
  const axis = dimensionTypes.find((dt) => dt.name === dimension.slice_type)
    ?.axis;

  if (dimension.axis_type === "aggregated_slice") {
    // HACK: It would be difficult to compute what datasets match the context
    // so just return them all.
    return api.fetchDatasets({
      [axis === "sample" ? "sample_type" : "feature_type"]: dimension.context
        .dimension_type,
    });
  }

  if (!(typeof expr === "object") || !("==" in expr)) {
    throw new Error("Malformed context expression");
  }

  if (axis === "sample") {
    return api.fetchDatasets({
      sample_id: expr["=="][1],
      sample_type: dimension.context.dimension_type,
    });
  }

  return api.fetchDatasets({
    feature_id: expr["=="][1],
    feature_type: dimension.context.dimension_type,
  });
}

async function fetchContextCompatibleDatasetIds(
  api: ReturnType<typeof useDataExplorerApi>,
  dimension: State["dimension"]
) {
  const datasets = await fetchContextCompatibleDatasets(api, dimension);

  if (!datasets) {
    return null;
  }

  return new Set(datasets.map(({ id }) => id));
}

async function fetchContextCompatibleDataTypes(
  api: ReturnType<typeof useDataExplorerApi>,
  dimension: State["dimension"]
) {
  const datasets = await fetchContextCompatibleDatasets(api, dimension);

  if (!datasets) {
    return null;
  }

  const dataTypes = new Set<string>();

  datasets.forEach((d) => {
    dataTypes.add(d.data_type);
  });

  return dataTypes;
}

async function computeDataTypeOptions(
  api: ReturnType<typeof useDataExplorerApi>,
  index_type: string | null,
  dimension: State["dimension"]
) {
  const [
    datasets,
    contextCompatibleDataTypes,
    dimensionTypes,
  ] = await Promise.all([
    fetchIndexCompatibleDatasets(api, index_type),
    fetchContextCompatibleDataTypes(api, dimension),
    api.fetchDimensionTypes(),
  ]);

  const dataTypes = [...new Set(datasets.map((d) => d.data_type))].sort(
    compareCaseInsensitive
  );

  const sliceDisplayName =
    dimensionTypes.find((dt) => dt.name === dimension.slice_type)
      ?.display_name ||
    dimension.slice_type ||
    "(unknown type)";

  return dataTypes
    .map((dataType) => {
      let isDisabled = false;
      let disabledReason = "";

      const isCompatibleWithSliceType =
        !dimension.slice_type ||
        datasets.find((dataset) => {
          return (
            dataset.data_type === dataType &&
            dataset.slice_type === dimension.slice_type
          );
        }) !== undefined;

      if (!isCompatibleWithSliceType) {
        isDisabled = true;

        disabledReason = [
          "The",
          isSampleType(dimension.slice_type, dimensionTypes)
            ? "sample type"
            : "feature type",
          `“${dimension.slice_type as string}”`,
          "is incompatible with this data type",
        ].join(" ");
      } else if (
        contextCompatibleDataTypes &&
        !contextCompatibleDataTypes.has(dataType)
      ) {
        isDisabled = true;

        const dimensionLabel = dimension.context!.name;

        if (dimension.axis_type === "aggregated_slice") {
          disabledReason = [
            `The context “${dimensionLabel}”`,
            `has no ${pluralize(sliceDisplayName)} associated with this type`,
          ].join(" ");
        } else {
          disabledReason = [
            `The ${sliceDisplayName} “${dimensionLabel}”`,
            "is not found in any data versions associated with this type",
          ].join(" ");
        }
      }

      return {
        label: dataType,
        value: dataType,
        isDisabled,
        disabledReason,
      };
    })
    .sort(compareDisabledLast);
}

async function computeSliceTypeOptions(
  api: ReturnType<typeof useDataExplorerApi>,
  index_type: string | null,
  selectedDataType: string | null
) {
  const [datasets, dimensionTypes] = await Promise.all([
    fetchIndexCompatibleDatasets(api, index_type),
    api.fetchDimensionTypes(),
  ]);

  const sliceTypeOptions: State["sliceTypeOptions"] = [];
  const seen = new Set<string>();

  datasets.forEach((dataset) => {
    if (!seen.has(dataset.slice_type)) {
      const label =
        dimensionTypes.find((d) => d.name === dataset.slice_type)
          ?.display_name || dataset.slice_type;

      let isDisabled = false;
      let disabledReason = "";

      const isCompatibleWithDataType =
        !selectedDataType ||
        datasets.find(
          (d) =>
            d.data_type === selectedDataType &&
            d.slice_type === dataset.slice_type
        ) !== undefined;

      if (!isCompatibleWithDataType) {
        isDisabled = true;

        disabledReason = [
          "The data type",
          `“${selectedDataType}”`,
          "is incompatible with this",
          isSampleType(dataset.slice_type, dimensionTypes)
            ? "sample type"
            : "feature type",
        ].join(" ");
      }

      sliceTypeOptions.push({
        label,
        value: dataset.slice_type,
        isDisabled,
        disabledReason,
      });
    }

    seen.add(dataset.slice_type);
  });

  return sliceTypeOptions.sort((a, b) => {
    if (a.isDisabled && !b.isDisabled) {
      return 1;
    }

    if (!a.isDisabled && b.isDisabled) {
      return -1;
    }

    return compareCaseInsensitive(a.label, b.label);
  });
}

async function computeDataVersionOptions(
  api: ReturnType<typeof useDataExplorerApi>,
  index_type: string | null,
  selectedDataType: string | null,
  dimension: State["dimension"]
) {
  const [
    datasets,
    contextCompatibleDatasetIds,
    dimensionTypes,
  ] = await Promise.all([
    fetchIndexCompatibleDatasets(api, index_type),
    fetchContextCompatibleDatasetIds(api, dimension),
    api.fetchDimensionTypes(),
  ]);

  // TODO:
  //        disabledReason = [
  //          "This version is only compatible with the measure",
  //          `“${dataset.units}”`,
  //        ].join(" ");

  return datasets
    .filter((d) => !selectedDataType || d.data_type === selectedDataType)
    .sort((a, b) => compareCaseInsensitive(a.name, b.name))
    .map((dataset) => {
      let isDisabled = false;
      let disabledReason = "";

      const typeDisplayName =
        dimensionTypes.find((dt) => dt.name === dataset.slice_type)
          ?.display_name || dataset.slice_type;

      if (dimension.slice_type && dataset.slice_type !== dimension.slice_type) {
        isDisabled = true;

        disabledReason = [
          "This version is only compatible with",
          isSampleType(dimension.slice_type, dimensionTypes)
            ? "sample"
            : "feature",
          `type “${typeDisplayName}”`,
        ].join(" ");
      } else if (
        contextCompatibleDatasetIds &&
        !contextCompatibleDatasetIds.has(dataset.id)
      ) {
        isDisabled = true;

        if (dimension.axis_type === "aggregated_slice") {
          disabledReason = [
            `The context “${dimension.context!.name}”`,
            `has no ${pluralize(typeDisplayName)}`,
            "found in this version",
          ].join(" ");
        } else {
          disabledReason = [
            `The ${typeDisplayName} “${dimension.context!.name}”`,
            "is not found in this version",
          ].join(" ");
        }
      }

      return {
        label: dataset.name,
        value: dataset.id,
        isDisabled,
        disabledReason,
        isDefault: false,
      };
    })
    .sort(compareDisabledLast);
}

export default async function computeOptions(
  api: ReturnType<typeof useDataExplorerApi>,
  index_type: string | null,
  selectedDataType: string | null,
  dimension: State["dimension"]
) {
  const [
    dataTypeOptions,
    sliceTypeOptions,
    dataVersionOptions,
  ] = await Promise.all([
    computeDataTypeOptions(api, index_type, dimension),
    computeSliceTypeOptions(api, index_type, selectedDataType),
    computeDataVersionOptions(api, index_type, selectedDataType, dimension),
  ]);

  return {
    dataTypeOptions,
    sliceTypeOptions,
    dataVersionOptions,
    // FIXME
    unitsOptions: [] as State["unitsOptions"],
  };
}
