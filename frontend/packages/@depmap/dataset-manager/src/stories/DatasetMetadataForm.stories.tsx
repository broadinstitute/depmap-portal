import * as React from "react";
import DatasetMetadataForm from "../components/DatasetMetadataForm";

export default {
  title: "Components/DatasetMetadataForm",
  component: DatasetMetadataForm,
};

export function DatasetMetadataFormStory() {
  return (
    <DatasetMetadataForm forwardDatasetMetadataDict={() => console.log("HI")} />
  );
}
