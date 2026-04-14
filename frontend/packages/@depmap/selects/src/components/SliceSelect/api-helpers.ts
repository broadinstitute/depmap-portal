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

  const isFeature = dimType.axis === "feature";

  const result = isFeature
    ? await cached(breadboxAPI).getDatasetFeatures(dataset_id)
    : await cached(breadboxAPI).getDatasetSamples(dataset_id);

  if ("detail" in result) {
    throw new Error(JSON.stringify(result.detail));
  }

  return result;
}

/**
 * Fetches features for a dataset that has no typed feature dimension.
 * Used by DatasetSpecificSliceSelect where the dataset's features are generic.
 */
export async function fetchDatasetFeatures(dataset_id: string) {
  const result = await cached(breadboxAPI).getDatasetFeatures(dataset_id);

  if ("detail" in result) {
    throw new Error(JSON.stringify(result.detail));
  }

  return result;
}

export async function fetchDimensionTypeDisplayName(dimensionTypeName: string) {
  const dimensionTypes = await cached(breadboxAPI).getDimensionTypes();
  const dimType = dimensionTypes.find((t) => t.name === dimensionTypeName);

  if (!dimType) {
    throw new Error(`Unrecognized dimension type "${dimensionTypeName}"!`);
  }

  return dimType.display_name || dimType.name;
}

export async function fetchDatasetName(dataset_id: string | null) {
  if (!dataset_id) {
    return "";
  }

  const datasets = await cached(breadboxAPI).getDatasets();
  const dataset = datasets.find((d) => {
    return d.id === dataset_id || d.given_id === dataset_id;
  });

  if (!dataset) {
    throw new Error(`Unknown dataset "${dataset_id}".`);
  }

  return dataset.name;
}
