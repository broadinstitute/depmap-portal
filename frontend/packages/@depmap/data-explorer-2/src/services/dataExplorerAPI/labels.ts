// Display strings and type information describing a plot's axes and datasets
// (axis titles, entity names, dataset names, value types). Shared by the
// standard and expanded plot assemblers.
import { breadboxAPI, cached, evaluateContextPersisted } from "@depmap/api";
import {
  DataExplorerContextV2,
  DataExplorerPlotConfigDimension,
  isValidSliceQuery,
  SliceQuery,
} from "@depmap/types";
import { isContextAll } from "../../utils/contextExpr";
import { isCompleteDimension, pluralize } from "../../utils/dimensionHelpers";
import { fetchDatasetIdentifiers } from "./identifiers";

export async function fetchEntitiesLabel(dimensionType: string) {
  const dimensionTypes = await cached(breadboxAPI).getDimensionTypes();
  const dimType = dimensionTypes.find((t) => t.name === dimensionType);

  return dimType
    ? pluralize(dimType.display_name || dimType.name)
    : "unknown entities";
}

export async function fetchAxisLabel(
  dimension?: DataExplorerPlotConfigDimension
) {
  if (!dimension || !isCompleteDimension(dimension)) {
    return "";
  }

  const { context } = dimension;
  const datasets = await cached(breadboxAPI).getDatasets();

  const dataset = datasets.find((d) => {
    return d.id === dimension.dataset_id || d.given_id === dimension.dataset_id;
  });

  let units = "";

  if (dataset && "units" in dataset) {
    units = dataset.units;
  }

  if (units === "unitless") {
    units = "";
  }

  if (dimension.axis_type === "raw_slice") {
    return `${context.name} ${units}`;
  }

  const { aggregation } = dimension;

  const { ids } = await evaluateContextPersisted(
    (context as unknown) as DataExplorerContextV2
  );

  const dsIdentifiers = await fetchDatasetIdentifiers(
    dimension.slice_type,
    dimension.dataset_id
  );

  const idsInDataset = new Set(dsIdentifiers.map(({ id }) => id));
  const overlappingIds = ids.filter((id) => idsInDataset.has(id));
  const contextCount = overlappingIds.length.toLocaleString();

  const entities = await fetchEntitiesLabel(dimension.slice_type);

  if (isContextAll(context)) {
    return `${aggregation} ${units} of all ${contextCount} ${entities}`;
  }

  return `${aggregation} ${units} of ${contextCount} ${context.name} ${entities}`;
}

export async function fetchValueType(
  dimensionOrSliceQuery?: DataExplorerPlotConfigDimension | SliceQuery
) {
  if (
    !dimensionOrSliceQuery ||
    (!isCompleteDimension(dimensionOrSliceQuery) &&
      !isValidSliceQuery(dimensionOrSliceQuery))
  ) {
    return "continuous";
  }

  // The root of a SliceQuery always describes the data column itself —
  // reindex_through only describes FK hops for reindexing. So dataset_id
  // and identifier here are already correct for the value type lookup.
  const { dataset_id } = dimensionOrSliceQuery;

  const dataset = await cached(breadboxAPI).getDataset(dataset_id);

  if (!dataset) {
    throw new Error(`Unknown dataset "${dataset_id}"`);
  }

  if (dataset.format !== "matrix_dataset") {
    if (isCompleteDimension(dimensionOrSliceQuery)) {
      throw new Error(
        "Dataset is not a matrix! This is not supported for plot dimensions."
      );
    }

    return dataset.columns_metadata[dimensionOrSliceQuery.identifier].col_type;
  }

  return dataset.value_type;
}

export async function fetchDatasetLabel(dataset_id?: string) {
  if (!dataset_id) {
    return "";
  }

  const datasets = await cached(breadboxAPI).getDatasets();

  const dataset = datasets.find((d) => {
    return d.id === dataset_id || d.given_id === dataset_id;
  });

  return dataset ? dataset.name : "(Unknown dataset)";
}
