import { breadboxAPI, cached } from "@depmap/api";

export async function fetchMetadata<T>(
  typeName: string,
  indices: string[] | null,
  columns: string[] | null,
  bbapi: typeof breadboxAPI,
  identifier: "label" | "id" = "id"
) {
  const dimType = await cached(bbapi).getDimensionType(typeName);
  if (!dimType?.metadata_dataset_id) {
    throw new Error(`No metadata for ${typeName}`);
  }

  let args;
  if (indices && indices.length > 0) {
    args = { indices, identifier, columns };
  } else {
    args = { indices: null, identifier: null, columns };
  }
  return cached(bbapi).getTabularDatasetData(
    dimType.metadata_dataset_id,
    args
  ) as Promise<T>;
}
