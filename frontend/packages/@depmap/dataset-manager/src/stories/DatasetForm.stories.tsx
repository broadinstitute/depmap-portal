import * as React from "react";
import {
  DimensionType,
  Group,
  InvalidPrioritiesByDataType,
  UploadFileResponse,
} from "@depmap/types";
import DatasetForm from "../components/DatasetForm";

export default {
  title: "Components/DatasetForm",
  component: DatasetForm,
};

async function getDimensionTypes(): Promise<DimensionType[]> {
  const dimensionTypes = [
    {
      name: "generic",
      display_name: "Generic",
      id_column: "label",
      axis: "feature",
    },
    {
      name: "gene",
      display_name: "Gene",
      id_column: "entrez_id",
      axis: "feature",
    },
    {
      name: "depmap_model",
      display_name: "Depmap Model",
      id_column: "depmap_id",
      axis: "sample",
    },
  ];
  return dimensionTypes as DimensionType[];
}

async function getGroups() {
  const groups: Group[] = [
    {
      id: "00000000-0000-0000-0000-000000000000",
      name: "Public",
      group_entries: [],
      datasets: [],
    },
  ];
  return groups;
}

async function getDataTypesAndPriorities() {
  const dataTypeAndPriorities: InvalidPrioritiesByDataType = {
    "User upload": [],
    CRISPR: [1],
    "Drug screen": [1],
    RNAi: [],
  };
  return dataTypeAndPriorities;
}
let counter = 0;
async function uploadFile(): Promise<UploadFileResponse> {
  counter++;
  console.log(counter);
  // Uncomment below to test error in uploading
  // if (counter == 1) { // TODO need to handle if first chunk failed UI
  //   throw new Error("Fake error");
  // }
  return { file_id: `id-${counter}` };
}

async function uploadDataset(datasetParams: any) {
  console.log(datasetParams);
}

export function DatasetFormStory() {
  return (
    <DatasetForm
      getDimensionTypes={getDimensionTypes}
      getGroups={getGroups}
      getDataTypesAndPriorities={getDataTypesAndPriorities}
      uploadFile={uploadFile}
      uploadDataset={uploadDataset}
    />
  );
}
