import { breadboxAPI, cached } from "@depmap/api";

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
  dimensionTypeName: string,
  dataset_id: string
) {
  const dimensionTypes = await cached(breadboxAPI).getDimensionTypes();
  const dimType = dimensionTypes.find((t) => t.name === dimensionTypeName);

  if (!dimType) {
    throw new Error(`Unrecognized dimension type "${dimensionTypeName}"!`);
  }

  return dimType.axis === "feature"
    ? cached(breadboxAPI).getMatrixDatasetFeatures(dataset_id)
    : cached(breadboxAPI).getMatrixDatasetSamples(dataset_id);
}
