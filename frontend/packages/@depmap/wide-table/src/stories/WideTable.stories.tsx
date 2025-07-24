import * as React from "react";
import WideTable, { WideTableProps } from "../WideTable";

export default {
  title: "Components/Common/WideTable",
  component: WideTable,
};

const defaultWideTableProps: WideTableProps = {
  data: [
    {
      "Column 1": "9.95E-06",
      "Column 2": "Some othervalue",
      "Column 3": "Some third value A",
    },
    {
      "Column 1": "9.96E-11",
      "Column 2": "Some othervalue",
      "Column 3": "Some third value B",
    },
    {
      "Column 1": "9.99E-05",
      "Column 2": "Some othervalue",
      "Column 3": "Some third value C",
    },
  ],
  columns: [
    { accessor: "Column 1" },
    { accessor: "Column 2" },
    { accessor: "Column 3" },
  ],
  defaultColumnsToShow: ["Column 1", "Column 3"],
  singleSelectionMode: false,
  selectedTableLabels: new Set(),
};

export const TwoVisibleColumnsOneHidden = () => (
  <WideTable
    {...defaultWideTableProps}
    columns={[
      defaultWideTableProps.columns[0],
      defaultWideTableProps.columns[1],
      {
        accessor: "Column 3",
        helperText: "This is the third column.",
      },
    ]}
  />
);

export const OneColumn = () => (
  <WideTable
    data={[
      {
        "Column 1": "9.95E-06",
      },
      {
        "Column 1": "9.45E-06",
      },
      {
        "Column 1": "2.95E-06",
      },
      {
        "Column 1": "5.95E-06",
      },
    ]}
    columns={[{ accessor: "Column 1" }]}
    defaultColumnsToShow={["Column 1"]}
  />
);
