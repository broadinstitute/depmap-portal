import { getDimensionTypeLabel } from "../../../../../utils/misc";
import { DataExplorerPlotResponse } from "@depmap/types";

type FormattedData = Record<string, unknown[]>;

const applyFilter = (
  formattedData: FormattedData,
  filter: boolean[] | undefined
) => {
  if (!filter) {
    return formattedData;
  }

  const filtered: FormattedData = {};

  Object.keys(formattedData).forEach((key) => {
    filtered[key] = formattedData[key].filter((_, i) => filter[i]);
  });

  return filtered;
};

export default function plotToLookupTable(data: DataExplorerPlotResponse) {
  const indexColumn = getDimensionTypeLabel(data.index_type);

  // For depmap_model, the legacy CSV layout has two columns: depmap IDs
  // in "Cell Line" and cell line names in "Cell Line Name". Preserve
  // that exact shape, now reading IDs from `index_ids` and names from
  // `index_labels` (which post-refactor carries real labels for all
  // types, including depmap_model). For other dimension types, the
  // single primary column continues to carry labels.
  const primaryColumnValues =
    data.index_type === "depmap_model" ? data.index_ids : data.index_labels;

  let formattedData: FormattedData = { [indexColumn]: primaryColumnValues };

  if (data.index_type === "depmap_model") {
    formattedData["Cell Line Name"] = data.index_labels;
  }

  Object.values(data.dimensions).forEach((dimension) => {
    const label = `"${dimension.axis_label} ${dimension.dataset_label}"`;
    formattedData[label] = dimension.values;
  });

  Object.values(data.metadata || {}).forEach((slice) => {
    formattedData[slice!.label] = slice!.values;
  });

  formattedData = applyFilter(formattedData, data?.filters?.visible?.values);

  return { indexColumn, formattedData };
}
