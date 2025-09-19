import { breadboxAPI, cached } from "@depmap/api";
import { compareCaseInsensitive, compareDisabledLast } from "@depmap/utils";
import {
  isSampleType,
  pluralize,
  sortDimensionTypes,
} from "../../../utils/misc";
import { State, SliceTypeNull, SLICE_TYPE_NULL } from "./types";
import { fetchDatasetsByIndexType } from "./utils";

async function fetchIndexCompatibleDatasets(
  index_type: string | null,
  selectedDatasetId: string | null
) {
  if (!index_type) {
    return [];
  }

  const datasets = await fetchDatasetsByIndexType(
    index_type,
    selectedDatasetId
  );

  if (datasets.length === 0) {
    throw new Error(`Unknown dimension type "${index_type}".`);
  }

  return datasets;
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
        sample_type: dimension.slice_type as string,
      });
    } catch (e) {
      return [];
    }
  }

  try {
    if (dimension.slice_type !== null) {
      return await cached(breadboxAPI).getDatasets({
        [property]: idOrLabel,
        feature_type: dimension.slice_type,
      });
    }

    return await cached(breadboxAPI)
      .getDatasets()
      .then((datasets) => {
        return datasets.filter(
          (d) => d.format === "matrix_dataset" && d.feature_type_name === null
        );
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
    fetchIndexCompatibleDatasets(index_type, dimension?.dataset_id || null),
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

  if (dimension.slice_type === null && dimension.dataset_id) {
    const selectedDataType = datasets.find(
      (d) =>
        d.id === dimension.dataset_id || d.given_id === dimension.dataset_id
    )?.data_type;

    return dataTypes.map((dataType) => {
      let isDisabled = false;
      let disabledReason = "";

      if (dataType !== selectedDataType) {
        isDisabled = true;
        disabledReason = "Clear the Data Version to use this type.";
      }

      return {
        label: dataType,
        value: dataType,
        isDisabled,
        disabledReason,
      };
    });
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
  selectedDataType: string | null,
  dimension: State["dimension"]
) {
  const [datasets, dimensionTypes] = await Promise.all([
    fetchIndexCompatibleDatasets(index_type, dimension.dataset_id || null),
    cached(breadboxAPI).getDimensionTypes(),
  ]);

  const sliceTypeOptions: State["sliceTypeOptions"] = [];
  const seen = new Set<string | SliceTypeNull>();

  datasets.forEach((dataset) => {
    if (!dimension.dataset_id && dataset.slice_type === SLICE_TYPE_NULL) {
      return;
    }

    if (dataset.slice_type !== null && !seen.has(dataset.slice_type)) {
      const label =
        dimensionTypes.find((d) => d.name === dataset.slice_type)
          ?.display_name || dataset.slice_type.toString();

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
          typeof dataset.slice_type === "string" &&
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

    if (dataset.slice_type !== null) {
      seen.add(dataset.slice_type);
    }
  });

  if (
    // If this datatype has any datasets with a `null`
    // feature type...
    Boolean(
      isSampleType(index_type, dimensionTypes) &&
        datasets.some((d) => d.slice_type === null)
    ) ||
    // ... or we've already inferred the slice_type is null...
    Boolean(dimension.slice_type === null && !seen.has(SLICE_TYPE_NULL))
  ) {
    // ... then make sure a corresponding option exists.
    sliceTypeOptions.unshift({
      label: SLICE_TYPE_NULL.toString(),
      value: SLICE_TYPE_NULL,
      isDisabled: false,
      disabledReason: "",
    });
  }

  return sliceTypeOptions.sort((a, b) => {
    if (a.isDisabled && !b.isDisabled) {
      return 1;
    }

    if (!a.isDisabled && b.isDisabled) {
      return -1;
    }

    const [sorted] = sortDimensionTypes([
      a.value.toString(),
      b.value.toString(),
    ]);

    return sorted === a.value ? -1 : 1;
  });
}

async function computeDataVersionOptions(
  index_type: string | null,
  selectedDataType: string | null,
  allowNullFeatureType: boolean,
  dimension: State["dimension"]
) {
  const [
    datasets,
    contextCompatibleDatasetIds,
    dimensionTypes,
  ] = await Promise.all([
    fetchIndexCompatibleDatasets(index_type, dimension.dataset_id || null),
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
      d.slice_type === dimension.slice_type &&
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
    .filter((d) => allowNullFeatureType || d.slice_type !== SLICE_TYPE_NULL)
    .sort((a, b) => compareCaseInsensitive(a.name, b.name))
    .map((dataset) => {
      let isDisabled = false;
      let disabledReason = "";

      const typeDisplayName = dataset.slice_type_display_name;

      if (
        dimension.dataset_id &&
        dimension.slice_type === null &&
        dataset.slice_type.valueOf() === null
      ) {
        if (
          dimension.context &&
          dimension.dataset_id !== dataset.id &&
          dimension.dataset_id !== dataset.given_id
        ) {
          isDisabled = true;
          disabledReason = [
            "Clear the feature in order to use this version (its features ",
            "are not compatible because they are specific to the data version ",
            "itself).",
          ].join("");
        }
      } else if (
        dataset.slice_type.valueOf() === null &&
        dimension.axis_type === "aggregated_slice"
      ) {
        isDisabled = true;
        disabledReason = [
          "This version cannot be used because a context ",
          "can’t be created from the generic features in it.",
        ].join("");
      } else if (
        dimension.slice_type !== undefined &&
        dataset.slice_type.valueOf() !== dimension.slice_type
      ) {
        isDisabled = true;

        disabledReason = dataset.slice_type.valueOf()
          ? [
              "This version is only compatible with",
              isSampleType(dimension.slice_type, dimensionTypes)
                ? "sample"
                : "feature",
              `type “${typeDisplayName}”`,
            ].join(" ")
          : [
              "Clear the Feature Type in order to use this version",
              "(it uses generic features that don’t have a type).",
            ].join(" ");
      } else if (
        contextCompatibleDatasetIds &&
        !contextCompatibleDatasetIds.has(dataset.id)
      ) {
        isDisabled = true;

        if (dimension.axis_type === "aggregated_slice") {
          disabledReason = [
            `The context “${dimension.context!.name}”`,
            `has no ${pluralize(typeDisplayName as string)}`,
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
        value: dataset.given_id || dataset.id,
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
  allowNullFeatureType: boolean,
  dimension: State["dimension"]
) {
  const [
    dataTypeOptions,
    sliceTypeOptions,
    dataVersionOptions,
  ] = await Promise.all([
    computeDataTypeOptions(index_type, dimension),
    computeSliceTypeOptions(index_type, selectedDataType, dimension),
    computeDataVersionOptions(
      index_type,
      selectedDataType,
      allowNullFeatureType,
      dimension
    ),
  ]);

  return {
    dataTypeOptions,
    sliceTypeOptions,
    dataVersionOptions,
    // FIXME
    unitsOptions: [] as State["unitsOptions"],
  };
}
