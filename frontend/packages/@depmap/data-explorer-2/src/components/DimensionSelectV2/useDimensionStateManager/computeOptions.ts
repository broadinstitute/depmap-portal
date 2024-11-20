import { MatrixDataset } from "@depmap/types";
import { useDataExplorerApi } from "../../../contexts/DataExplorerApiContext";
import { isSampleType } from "../../../utils/misc";
import { State } from "./types";

const collator = new Intl.Collator("en", { sensitivity: "base" });
const compareCaseInsensitive = collator.compare;

const disabledLast = (
  a: { isDisabled: boolean },
  b: { isDisabled: boolean }
) => {
  if (a.isDisabled && !b.isDisabled) {
    return 1;
  }

  if (!a.isDisabled && b.isDisabled) {
    return -1;
  }

  return 0;
};

async function fetchIndexCompatibleDatasets(
  api: ReturnType<typeof useDataExplorerApi>,
  index_type: string | null
) {
  const datasets = await api.fetchDatasets();

  return (
    datasets
      // TODO: Add support for tabular datasets
      .filter((d) => d.format === "matrix_dataset")
      .filter((d) => {
        return (
          !index_type ||
          (d as MatrixDataset).sample_type_name === index_type ||
          (d as MatrixDataset).feature_type_name === index_type
        );
      })
  );
}

async function computeDataTypeOptions(
  api: ReturnType<typeof useDataExplorerApi>,
  index_type: string | null,
  dimension: State["dimension"]
) {
  const datasets = await fetchIndexCompatibleDatasets(api, index_type);
  const dimensionTypes = await api.fetchDimensionTypes();

  const dataTypes = [
    ...new Set(
      datasets
        // TODO: Add support for tabular datasets
        .filter((d) => d.format === "matrix_dataset")
        .map((d) => d.data_type)
    ),
  ].sort(compareCaseInsensitive);

  return dataTypes
    .map((dataType) => {
      let isDisabled = false;
      let disabledReason = "";

      const isCompatibleWithSliceType =
        !dimension.slice_type ||
        datasets.find(
          (d) =>
            d.data_type === dataType &&
            ((d as MatrixDataset).sample_type_name === dimension.slice_type ||
              (d as MatrixDataset).feature_type_name === dimension.slice_type)
        ) !== undefined;

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
      }

      return {
        label: dataType,
        value: dataType,
        isDisabled,
        disabledReason,
      };
    })
    .sort(disabledLast);
}

async function computeSliceTypeOptions(
  api: ReturnType<typeof useDataExplorerApi>,
  index_type: string | null,
  selectedDataType: string | null
) {
  const datasets = await fetchIndexCompatibleDatasets(api, index_type);

  const dimensionTypes = await api.fetchDimensionTypes();
  const indexAxis =
    dimensionTypes.find((d) => (index_type ? d.name === index_type : false))
      ?.axis || null;

  const sliceTypeOptions: State["sliceTypeOptions"] = [];
  const seen = new Set<string>();

  datasets.forEach((dataset) => {
    // TODO: Add support for tabular datasets
    if (dataset.format === "matrix_dataset") {
      let sliceTypes = [
        dataset.feature_type_name,
        dataset.sample_type_name,
      ].filter(Boolean);

      if (indexAxis === "sample" && dataset.feature_type_name) {
        sliceTypes = [dataset.feature_type_name];
      }

      if (indexAxis === "feature" && dataset.sample_type_name) {
        sliceTypes = [dataset.sample_type_name];
      }

      sliceTypes.forEach((sliceType) => {
        if (!seen.has(sliceType)) {
          const label =
            dimensionTypes.find((d) => d.name === sliceType)?.display_name ||
            sliceType;

          let isDisabled = false;
          let disabledReason = "";

          const isCompatibleWithDataType =
            !selectedDataType ||
            datasets.find(
              (d) =>
                d.data_type === selectedDataType &&
                ((d as MatrixDataset).sample_type_name === sliceType ||
                  (d as MatrixDataset).feature_type_name === sliceType)
            ) !== undefined;

          if (!isCompatibleWithDataType) {
            isDisabled = true;

            disabledReason = [
              "The data type",
              `“${selectedDataType}”`,
              "is incompatible with this",
              isSampleType(sliceType, dimensionTypes)
                ? "sample type"
                : "feature type",
            ].join(" ");
          }

          sliceTypeOptions.push({
            label,
            value: sliceType,
            isDisabled,
            disabledReason,
          });
        }

        seen.add(sliceType);
      });
    }
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
  const datasets = await fetchIndexCompatibleDatasets(api, index_type);
  const dimensionTypes = await api.fetchDimensionTypes();

  return (
    datasets
      // TODO: Add support for tabular datasets
      .filter((d) => d.format === "matrix_dataset")
      .filter((d) => !selectedDataType || d.data_type === selectedDataType)
      .sort((a, b) => compareCaseInsensitive(a.name, b.name))
      .map((dataset) => {
        const d = dataset as MatrixDataset;
        let isDisabled = false;
        let disabledReason = "";

        const sliceType =
          d.sample_type_name === index_type
            ? d.feature_type_name
            : d.sample_type_name;

        if (dimension.slice_type && sliceType !== dimension.slice_type) {
          isDisabled = true;

          const typeDisplayName =
            dimensionTypes.find((dt) => dt.name === sliceType)?.display_name ||
            sliceType;

          disabledReason = [
            "This version is only compatible with",
            isSampleType(dimension.slice_type, dimensionTypes)
              ? "sample"
              : "feature",
            `type “${typeDisplayName}”`,
          ].join(" ");
        }

        return {
          label: d.name,
          value: d.id,
          isDisabled,
          disabledReason,
          isDefault: false,
        };
      })
      .sort(disabledLast)
  );
}

export default async function computeOptions(
  api: ReturnType<typeof useDataExplorerApi>,
  index_type: string | null,
  selectedDataType: string | null,
  dimension: State["dimension"]
) {
  return {
    dataTypeOptions: await computeDataTypeOptions(api, index_type, dimension),
    sliceTypeOptions: await computeSliceTypeOptions(
      api,
      index_type,
      selectedDataType
    ),
    dataVersionOptions: await computeDataVersionOptions(
      api,
      index_type,
      selectedDataType,
      dimension
    ),

    // FIXME
    unitsOptions: [] as State["unitsOptions"],
  };
}
