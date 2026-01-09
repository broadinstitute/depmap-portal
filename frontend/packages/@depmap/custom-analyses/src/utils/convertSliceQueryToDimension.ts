import { breadboxAPI, cached } from "@depmap/api";
import {
  isValidSliceQuery,
  SliceQuery,
  DataExplorerPlotConfigDimensionV2,
} from "@depmap/types";

async function convertSliceQueryToDimension(
  index_type: string,
  sliceQuery: SliceQuery | null | undefined
) {
  if (!isValidSliceQuery(sliceQuery)) {
    return null;
  }

  const { dataset_id, identifier_type, identifier } = sliceQuery;

  if (identifier_type === "column") {
    throw new Error("Tabular datasets not supported.");
  }

  const dataset = await cached(breadboxAPI).getDataset(dataset_id);

  if (dataset.format === "tabular_dataset") {
    throw new Error("Tabular datasets not supported.");
  }

  const slice_type =
    dataset.sample_type_name === index_type
      ? dataset.feature_type_name || null
      : dataset.sample_type_name;

  let identifierLabel = identifier;

  if (
    slice_type !== null &&
    identifier_type !== "sample_label" &&
    identifier_type !== "feature_label"
  ) {
    const allIdentifiers = await cached(
      breadboxAPI
    ).getDimensionTypeIdentifiers(slice_type);

    const match = allIdentifiers.find(({ id }) => id === identifier);
    identifierLabel = match ? match.label : identifier;
  }

  return {
    axis_type: "raw_slice",
    aggregation: "first",
    slice_type,
    dataset_id,
    context: {
      dimension_type: slice_type,
      name: identifierLabel,
      expr: { "==": [{ var: "given_id" }, identifier] },
      vars: {},
    },
  } as DataExplorerPlotConfigDimensionV2;
}

export default convertSliceQueryToDimension;
