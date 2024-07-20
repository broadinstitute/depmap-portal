import * as React from "react";
import {
  FeatureType,
  Group,
  InvalidPrioritiesByDataType,
  SampleType,
  UploadFileResponse,
} from "@depmap/types";
import DatasetForm from "../components/DatasetForm";

export default {
  title: "Components/DatasetForm",
  component: DatasetForm,
};

async function getFeatureTypes(): Promise<FeatureType[]> {
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
  return featureTypes;
}

async function getSampleTypes(): Promise<SampleType[]> {
  const sampleTypes = [
    {
      name: "depmap_model",
      id_column: "depmap_id",
      dataset: null as any,
    },
  ];
  return sampleTypes;
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

async function uploadDataset(datasetParams) {
  console.log(datasetParams);
}

export function DatasetFormStory() {
  return (
    <DatasetForm
      getFeatureTypes={getFeatureTypes}
      getSampleTypes={getSampleTypes}
      getGroups={getGroups}
      getDataTypesAndPriorities={getDataTypesAndPriorities}
      uploadFile={uploadFile}
      uploadDataset={uploadDataset}
    />
  );
}
