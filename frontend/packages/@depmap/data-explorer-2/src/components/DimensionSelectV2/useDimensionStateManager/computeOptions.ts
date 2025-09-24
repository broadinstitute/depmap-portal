import { breadboxAPI, cached } from "@depmap/api";
import { compareCaseInsensitive, compareDisabledLast } from "@depmap/utils";
import {
  isSampleType,
  pluralize,
  sortDimensionTypes,
} from "../../../utils/misc";
import { State } from "./types";
import { fetchDatasetsByIndexType } from "./utils";

async function fetchIndexCompatibleDatasets(index_type: string | null) {
  const datasets = await fetchDatasetsByIndexType();

  if (!index_type || !(index_type in datasets)) {
    return [];
  }

  if (!(index_type in datasets)) {
    throw new Error(`Unknown dimension type "${index_type}".`);
  }

  return datasets[index_type];
}

async function fetchContextCompatibleDatasets(dimension: State["dimension"]) {
  if (!dimension.context) {
    return null;
  }

  const expr = dimension.context.expr;

  const dimensionTypes = await cached(breadboxAPI).getDimensionTypes();
  const axis = dimensionTypes.find((dt) => dt.name === dimension.slice_type)
    ?.axis;

  if (dimension.axis_type === "aggregated_slice") {
    // HACK: It would be difficult to compute what datasets match the context
    // so just return them all.
    return cached(breadboxAPI).getDatasets({
      [axis === "sample" ? "sample_type" : "feature_type"]: dimension.context
        .dimension_type,
    });
  }

  if (!(typeof expr === "object") || !("==" in expr)) {
    throw new Error("Malformed context expression");
  }

  const [variable, idOrLabel] = expr["=="];
  const varName = variable.var;

  const property = (() => {
    if (varName === "given_id") {
      return "id";
    }

    if (varName === "entity_label") {
      return "label";
    }

    if (varName in (dimension.context.vars || {})) {
      const { identifier } = dimension.context.vars[varName];

      if (["id", "label"].includes(identifier)) {
        return identifier;
      }
    }

    throw new Error("Unsupported format");
  })();

  if (axis === "sample") {
    try {
      return await cached(breadboxAPI).getDatasets({
        [property]: idOrLabel,
        sample_type: dimension.context.dimension_type,
      });
    } catch (e) {
      return [];
    }
  }

  try {
    return await cached(breadboxAPI).getDatasets({
      [property]: idOrLabel,
      feature_type: dimension.context.dimension_type,
    });
  } catch (e) {
    return [];
  }
}

async function fetchContextCompatibleDatasetIds(dimension: State["dimension"]) {
  const datasets = await fetchContextCompatibleDatasets(dimension);

  if (!datasets) {
    return null;
  }

  return new Set(datasets.map(({ id }) => id));
}

async function fetchContextCompatibleDataTypes(dimension: State["dimension"]) {
  const datasets = await fetchContextCompatibleDatasets(dimension);

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
  index_type: string | null,
  dimension: State["dimension"]
) {
  const [
    datasets,
    contextCompatibleDataTypes,
    dimensionTypes,
  ] = await Promise.all([
    fetchIndexCompatibleDatasets(index_type),
    fetchContextCompatibleDataTypes(dimension),
    cached(breadboxAPI).getDimensionTypes(),
  ]);

  const dataTypes = [...new Set(datasets.map((d) => d.data_type))].sort(
    compareCaseInsensitive
  );

  let sliceDisplayName =
    dimensionTypes.find((dt) => dt.name === dimension.slice_type)
      ?.display_name || dimension.slice_type;

  if (!sliceDisplayName) {
    const indexAxis = dimensionTypes.find((dt) => dt.name === index_type)?.axis;
    if (indexAxis) {
      sliceDisplayName = indexAxis === "sample" ? "feature" : "sample";
    } else {
      sliceDisplayName = "feature or sample";
    }
  }

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
            `has no ${pluralize(
              sliceDisplayName as string
            )} associated with this type`,
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
  index_type: string | null,
  selectedDataType: string | null
) {
  const [datasets, dimensionTypes] = await Promise.all([
    fetchIndexCompatibleDatasets(index_type),
    cached(breadboxAPI).getDimensionTypes(),
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

    const [sorted] = sortDimensionTypes([a.value, b.value]);
    return sorted === a.value ? -1 : 1;
  });
}

async function computeDataVersionOptions(
  index_type: string | null,
  selectedDataType: string | null,
  dimension: State["dimension"]
) {
  const [
    datasets,
    contextCompatibleDatasetIds,
    dimensionTypes,
  ] = await Promise.all([
    fetchIndexCompatibleDatasets(index_type),
    fetchContextCompatibleDatasetIds(dimension),
    cached(breadboxAPI).getDimensionTypes(),
  ]);

  // TODO:
  //        disabledReason = [
  //          "This version is only compatible with the measure",
  //          `“${dataset.units}”`,
  //        ].join(" ");

  let defaultDataset: typeof datasets[number] | null = null;

  for (const d of datasets) {
    if (
      d.data_type === selectedDataType &&
      d.priority !== null &&
      (!defaultDataset ||
        defaultDataset.priority === null ||
        defaultDataset.priority < d.priority)
    ) {
      defaultDataset = d;
    }
  }

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
        isDefault: dataset === defaultDataset,
      };
    })
    .sort(compareDisabledLast);
}

export default async function computeOptions(
  index_type: string | null,
  selectedDataType: string | null,
  dimension: State["dimension"]
) {
  const [
    dataTypeOptions,
    sliceTypeOptions,
    dataVersionOptions,
  ] = await Promise.all([
    computeDataTypeOptions(index_type, dimension),
    computeSliceTypeOptions(index_type, selectedDataType),
    computeDataVersionOptions(index_type, selectedDataType, dimension),
  ]);

  return {
    dataTypeOptions,
    sliceTypeOptions,
    dataVersionOptions,
    // FIXME
    unitsOptions: [] as State["unitsOptions"],
  };
}
