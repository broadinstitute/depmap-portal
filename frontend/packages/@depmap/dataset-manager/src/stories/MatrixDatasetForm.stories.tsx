import * as React from "react";

import { MatrixDatasetForm } from "../components/MatrixDatasetForm";
import { matrixFormSchema } from "../models/matrixDatasetFormSchema";

export default {
  title: "Components/MatrixDatasetForm",
  component: MatrixDatasetForm,
};

const initMatrixForm: { [key: string]: any } = {};
Object.keys(matrixFormSchema.properties)
  .concat("allowed_values")
  .map((key) => {
    if (
      typeof matrixFormSchema.properties[key] === "object" &&
      "default" in matrixFormSchema.properties[key]
    ) {
      initMatrixForm[key] = matrixFormSchema.properties[key].default;
    } else {
      initMatrixForm[key] = null;
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

export function MatrixDatasetFormStory() {
  return (
    <MatrixDatasetForm
      featureTypes={featureTypes}
      sampleTypes={sampleTypes}
      dataTypes={dataTypes}
      invalidDataTypePriorities={invalidDataTypePriorities}
      groups={groups}
      initFormData={initMatrixForm}
    />
  );
}
