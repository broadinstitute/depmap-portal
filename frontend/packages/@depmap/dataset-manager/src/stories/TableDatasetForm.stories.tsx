import * as React from "react";

import { TableDatasetForm } from "../components/TableDatasetForm";
import { tableFormSchema } from "../models/tableDatasetFormSchema";

export default {
  title: "Components/TableDatasetForm",
  component: TableDatasetForm,
};

const initTableForm: { [key: string]: any } = {};
Object.keys(tableFormSchema.properties).map((key) => {
  if (
    typeof tableFormSchema.properties[key] === "object" &&
    "default" in tableFormSchema.properties[key]
  ) {
    initTableForm[key] = tableFormSchema.properties[key].default;
  } else {
    initTableForm[key] = null;
  }
});

const featureTypes = [
  {
    name: "generic",
    id_column: "label",
    dataset: null as any,
  },
  {
    name: "gene",
    id_column: "entrez_id",
    dataset: null,
  },
];
const sampleTypes = [
  {
    name: "depmap_model",
    id_column: "depmap_id",
    dataset: null as any,
  },
];

const dataTypes = [{ name: "CRISPR" }, { name: "Expression" }];

const groups = [
  {
    id: "00000000-0000-0000-0000-000000000000",
    name: "Public",
    group_entries: [],
    datasets: [],
  },
];

const invalidDataTypePriorities = {
  CRISPR: [1],
  Expression: [],
};

export function TableDatasetFormStory() {
  return (
    <TableDatasetForm
      featureTypes={featureTypes}
      sampleTypes={sampleTypes}
      dataTypes={dataTypes}
      invalidDataTypePriorities={invalidDataTypePriorities}
      groups={groups}
      initFormData={initTableForm}
    />
  );
}
