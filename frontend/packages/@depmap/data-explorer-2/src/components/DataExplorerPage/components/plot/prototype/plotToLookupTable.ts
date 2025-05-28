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
  const cellLineDisplayNames = data.index_aliases?.[0];

  let formattedData: FormattedData = { [indexColumn]: data.index_labels };

  if (cellLineDisplayNames) {
    formattedData[cellLineDisplayNames.label] = cellLineDisplayNames.values;
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
