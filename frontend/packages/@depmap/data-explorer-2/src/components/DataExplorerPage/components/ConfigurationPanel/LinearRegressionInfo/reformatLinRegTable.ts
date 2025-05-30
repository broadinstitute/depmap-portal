import { LinRegInfo } from "@depmap/types";

// We need an an array of string arrays to fit the linear regression info into the StaticTable component
export const reformatLinRegTable = (groupPropsTable: LinRegInfo[]) => {
  if (!groupPropsTable || groupPropsTable.length === 0) {
    return undefined;
  }

  const staticTable = [];

  const headers = [
    "Number of Points",
    "Pearson",
    "Spearman",
    "Slope",
    "Intercept",
    "p-value (linregress)",
  ];

  if (groupPropsTable[0].group_label != null) {
    headers.splice(0, 0, "Group");
  }

  staticTable.push(headers);

  for (let index = 0; index < groupPropsTable.length; index++) {
    const tableRow = groupPropsTable[index];

    const row: (number | string)[] = [
      tableRow.number_of_points,
      tableRow.pearson.toFixed(3),
      tableRow.spearman.toFixed(3),
      tableRow.slope.toExponential(2),
      tableRow.intercept.toExponential(2),
      tableRow.p_value.toExponential(2),
    ].map((s) => (s === "NaN" ? "" : s));

    if (groupPropsTable[0].group_label != null) {
      row.splice(0, 0, tableRow.group_label as string);
    }

    staticTable.push(row);
  }

  return staticTable;
};
