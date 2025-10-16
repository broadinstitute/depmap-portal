import { breadboxAPI, cached } from "@depmap/api";
import { compareCaseInsensitive, compareDisabledLast } from "@depmap/utils";
import { DimensionType } from "@depmap/types";
import {
  isSampleType,
  pluralize,
  sortDimensionTypes,
} from "../../../utils/misc";
import { State, SLICE_TYPE_NULL } from "./types";
import {
  DataExplorerDatasetDescriptor,
  fetchDatasetsByIndexType,
} from "./utils";

function formatList(items: string[]) {
  if (items.length === 0) return "";
  if (items.length === 1) return items[0];
  if (items.length === 2) return items.join(" and ");
  return items.slice(0, -1).join(", ") + ", and " + items.at(-1);
}

async function fetchIndexCompatibleDatasets(
  index_type: string | null,
  selectedDatasetId: string | null,
  valueTypes: Set<"continuous" | "text" | "categorical" | "list_strings">
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

  return datasets.filter((d) =>
    valueTypes.has(
      d.value_type as typeof valueTypes extends Set<infer U> ? U : never
    )
  );
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
  dimension: State["dimension"],
  datasets: DataExplorerDatasetDescriptor[],
  dimensionTypes: DimensionType[]
) {
  const contextCompatibleDataTypes = await fetchContextCompatibleDataTypes(
    dimension
  );

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
          `“${sliceDisplayName}”`,
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
  selectedUnits: string | null,
  dimension: State["dimension"],
  datasets: DataExplorerDatasetDescriptor[],
  dimensionTypes: DimensionType[]
) {
  const sliceTypeOptions: State["sliceTypeOptions"] = [];
  const seen = new Set<string>();
  let selectedUnitsMatchNullSliceType = false;

  datasets.forEach((dataset) => {
    if (
      dataset.units === selectedUnits &&
      dataset.slice_type === SLICE_TYPE_NULL
    ) {
      selectedUnitsMatchNullSliceType = true;
    }

    if (dataset.slice_type === SLICE_TYPE_NULL) {
      return;
    }

    if (seen.has(dataset.slice_type as string)) {
      return;
    }

    seen.add(dataset.slice_type as string);

    const label =
      dimensionTypes.find((d) => d.name === dataset.slice_type)?.display_name ||
      dataset.slice_type.toString();

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
  });

  if (
    // If this datatype has any datasets with a `null`
    // feature type...
    Boolean(
      isSampleType(index_type, dimensionTypes) &&
        datasets.some((d) => d.slice_type === null)
    ) ||
    // ... or we've already inferred the slice_type is null...
    dimension.slice_type === null ||
    // ... or this special case
    selectedUnitsMatchNullSliceType
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
  selectedUnits: string | null,
  allowNullFeatureType: boolean,
  valueTypes: Set<"continuous" | "text" | "categorical" | "list_strings">,
  dimension: State["dimension"],
  datasets: DataExplorerDatasetDescriptor[],
  dimensionTypes: DimensionType[]
) {
  const contextCompatibleDatasetIds = await fetchContextCompatibleDatasetIds(
    dimension
  );

  let foundDefault = false;

  return datasets
    .filter((d) => !selectedDataType || d.data_type === selectedDataType)
    .filter((d) => allowNullFeatureType || d.slice_type !== SLICE_TYPE_NULL)
    .filter((d) =>
      valueTypes.has(
        d.value_type as typeof valueTypes extends Set<infer U> ? U : never
      )
    )
    .sort((a, b) => (a.priority ?? -Infinity) - (b.priority ?? -Infinity))
    .map((dataset) => {
      let isDisabled = false;
      let disabledReason = "";

      const typeDisplayName = dataset.slice_type_display_name;

      if (selectedUnits && selectedUnits !== dataset.units) {
        isDisabled = true;
        disabledReason = [
          "This version is only compatible with the measure",
          `“${dataset.units}”`,
        ].join(" ");
      }

      if (
        dimension.axis_type === "aggregated_slice" &&
        dataset.value_type !== "continuous"
      ) {
        isDisabled = true;
        disabledReason = [
          "You can't aggregate over this dataset because ",
          "its values are not numerical.",
        ].join("");
      }

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

      let isDefault = false;

      if (!foundDefault && !isDisabled) {
        foundDefault = true;
        isDefault = true;
      }

      return {
        label: dataset.name,
        value: dataset.given_id || dataset.id,
        isDisabled,
        disabledReason,
        isDefault,
      };
    })
    .sort((a, b) => compareCaseInsensitive(a.label, b.label))
    .sort(compareDisabledLast);
}

export async function computeUnitsOptions(
  index_type: string | null,
  selectedDataType: string | null,
  valueTypes: Set<"continuous" | "text" | "categorical" | "list_strings">,
  dimension: State["dimension"]
) {
  const [datasets, dimensionTypes] = await Promise.all([
    fetchIndexCompatibleDatasets(
      index_type,
      dimension.dataset_id || null,
      valueTypes
    ),
    cached(breadboxAPI).getDimensionTypes(),
  ]);

  const compatSliceTypes: Record<string, Set<string | null>> = {};

  for (const d of datasets) {
    compatSliceTypes[d.units] ||= new Set<string | null>();
    compatSliceTypes[d.units].add(d.slice_type.valueOf());
  }

  const unitsOptions = [
    ...new Set(
      datasets
        .filter((d) => {
          if (!d.units) {
            return false;
          }

          return !selectedDataType || d.data_type === selectedDataType;
        })
        .map((d) => d.units)
    ),
  ]
    .sort((a, b) => (a.toLowerCase() < b.toLowerCase() ? -1 : 1))
    .map((units) => {
      let isDisabled = false;
      let disabledReason = "";

      if (
        dimension.slice_type !== undefined &&
        !compatSliceTypes[units]?.has(dimension.slice_type)
      ) {
        isDisabled = true;

        const sliceTypes = [...compatSliceTypes[units]]
          .filter(Boolean)
          .map((dimensionTypeName) => {
            return (
              dimensionTypes.find((dt) => dt.name === dimensionTypeName)
                ?.display_name || dimensionTypeName
            );
          });

        const sampleOrFeature = isSampleType(
          dimension.slice_type,
          dimensionTypes
        )
          ? "sample"
          : "feature";

        disabledReason =
          sliceTypes.length > 0
            ? [
                "This measure is only compatible with",
                sampleOrFeature,
                sliceTypes.length === 1 ? "type" : "types",
                formatList(sliceTypes.map((t) => `“${t}”`)),
              ].join(" ")
            : `Clear the ${sampleOrFeature} type to use this measure`;
      }

      return {
        label: units,
        value: units,
        isDisabled,
        disabledReason,
      };
    });

  return unitsOptions;
}

export default async function computeOptions(
  index_type: string | null,
  selectedDataType: string | null,
  selectedUnits: string | null,
  allowNullFeatureType: boolean,
  valueTypes: Set<"continuous" | "text" | "categorical" | "list_strings">,
  dimension: State["dimension"]
) {
  const [datasets, dimensionTypes] = await Promise.all([
    fetchIndexCompatibleDatasets(
      index_type,
      dimension.dataset_id || null,
      valueTypes
    ),
    cached(breadboxAPI).getDimensionTypes(),
  ]);

  const [
    dataTypeOptions,
    sliceTypeOptions,
    dataVersionOptions,
    unitsOptions,
  ] = await Promise.all([
    computeDataTypeOptions(index_type, dimension, datasets, dimensionTypes),
    computeSliceTypeOptions(
      index_type,
      selectedDataType,
      selectedUnits,
      dimension,
      datasets,
      dimensionTypes
    ),
    computeDataVersionOptions(
      index_type,
      selectedDataType,
      selectedUnits,
      allowNullFeatureType,
      valueTypes,
      dimension,
      datasets,
      dimensionTypes
    ),
    computeUnitsOptions(index_type, selectedDataType, valueTypes, dimension),
  ]);

  return {
    dataTypeOptions,
    sliceTypeOptions,
    dataVersionOptions,
    unitsOptions,
  };
}
