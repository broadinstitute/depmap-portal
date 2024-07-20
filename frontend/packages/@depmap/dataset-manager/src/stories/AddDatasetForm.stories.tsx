import * as React from "react";
import { FeatureType, Group, SampleType } from "@depmap/types";
import DatasetForm from "../components/AddDatasetForm";

export default {
  title: "Components/AddDatasetForm",
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
      id: "00000000",
      name: "Public",
      group_entries: [],
      datasets: [],
    },
  ];
  return groups;
}

export function DatasetFormStory() {
  return (
    <DatasetForm
      onSubmit={(x, y, z) => console.log("HI")}
      datasetSubmissionError="BOO HOO"
      getFeatureTypes={getFeatureTypes}
      getSampleTypes={getSampleTypes}
      getGroups={getGroups}
    />
  );
}
