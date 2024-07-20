import * as React from "react";
import { LongTable, LongTableProps } from "../components/LongTable";

export default {
  title: "Components/Common/LongTable",
  component: LongTable,
};

let numFormatFunction = (num: number) => {
  if (num < 0 && num.toString().length > 3) return num.toPrecision(3);
  return num;
};

const defaultLongTableProps: LongTableProps = {
  dataFromProps: [
    {
      value: 0.5,
      lineage: "Bone",
      depmapId: "ACH-001001",
      label: "143B",
    },
    {
      value: -0.25,
      depmapId: "ACH-000001",
      label: "Cell line 2",
      lineage: "Skin",
    },
    {
      value: -0.24876,
      depmapId: "ACH-000011",
      label: "Cell line 2",
      lineage: "Skin",
    },
    {
      value: 0.253,
      depmapId: "ACH-002002",
      label: "Cell line 3",
      lineage: "Bone",
    },
    {
      value: 12559,
      depmapId: "ACH-002003",
      label: "Cell line 4",
      lineage: "Bone",
    },
    {
      value: -2559,
      depmapId: "ACH-002004",
      label: "Cell line 4",
      lineage: "Bone",
    },
  ],
  columns: [
    {
      key: "label",
      displayName: "Compound",
      type: "character",
      width: 150,
    },
    {
      key: "lineage",
      displayName: "Lineage",
      type: "categorical",
    },
    {
      key: "value",
      displayName: "Value",
      type: "continuous",
      numberFormatFunction: numFormatFunction,
    },
  ],
  idCol: "depmapId",
  addCheckboxes: true,
  defaultSort: { col: "depmapId", order: "ASC" },
  hiddenCols: ["depmapId"],
};

export const BasicLongTable = () => (
  <div style={{ height: "500px" }}>
    <LongTable
      dataFromProps={[
        { "Column 1": "Cell line A" },
        { "Column 1": "Cell line B" },
      ]}
    />
  </div>
);

export const LongTableStory = () => (
  <div style={{ height: "500px" }}>
    <LongTable {...defaultLongTableProps} />
  </div>
);
