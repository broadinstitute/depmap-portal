import { breadboxAPI, cached } from "@depmap/api";

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
    ? cached(breadboxAPI).getDatasetFeatures(dataset_id)
    : cached(breadboxAPI).getDatasetSamples(dataset_id);
}

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
    // FIXME: This query param makes things incredibly slow. I'm commenting it
    // out for now because it might not be adding much value. Only about 8% of
    // genes are not represented in a dataset somewhere.
    // show_only_dimensions_in_dataset: true,
  });
}
