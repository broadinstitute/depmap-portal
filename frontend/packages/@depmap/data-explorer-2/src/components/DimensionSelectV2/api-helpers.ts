import { breadboxAPI, cached } from "@depmap/api";
import { capitalize, getDimensionTypeLabel } from "../../utils/misc";
import { SliceTypeNull } from "./useDimensionStateManager/types";

export async function fetchDimensionIdentifiers(
  dimensionTypeName: string,
  dataType?: string
) {
  const dimensionTypes = await cached(breadboxAPI).getDimensionTypes();
  const dimType = dimensionTypes.find((t) => t.name === dimensionTypeName);

  if (!dimType) {
    throw new Error(`Unrecognized dimension type "${dimensionTypeName}"!`);
  }

  return cached(breadboxAPI).getDimensionTypeIdentifiers(dimensionTypeName, {
    data_type: dataType,
  });
}

export async function fetchDatasetIdentifiers(
  dimensionTypeName: string | SliceTypeNull,
  dataset_id: string
) {
  let isFeature = true;

  if (typeof dimensionTypeName === "string") {
    const dimensionTypes = await cached(breadboxAPI).getDimensionTypes();
    const dimType = dimensionTypes.find((t) => t.name === dimensionTypeName);

    if (!dimType) {
      throw new Error(`Unrecognized dimension type "${dimensionTypeName}"!`);
    }

    isFeature = dimType.axis === "feature";
  }

  const result = isFeature
    ? await cached(breadboxAPI).getDatasetFeatures(dataset_id)
    : await cached(breadboxAPI).getDatasetSamples(dataset_id);

  if ("detail" in result) {
    throw new Error(JSON.stringify(result.detail));
  }

  return result;
}

export async function fetchDimensionTypeDisplayName(
  dimensionTypeName: string | null
) {
  if (!dimensionTypeName) {
    return "";
  }

  const dimensionTypes = await cached(breadboxAPI).getDimensionTypes();
  const dimType = dimensionTypes.find((t) => t.name === dimensionTypeName);

  return (
    dimType?.display_name ||
    capitalize(getDimensionTypeLabel(dimensionTypeName))
  );
}
