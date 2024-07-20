import * as React from "react";
import { useState } from "react";
import ReactDOM from "react-dom";
import { TableDatasetForm } from "./TestTableDatasetForm";

export default {
  title: "Components/TableDatasetForm",
  component: TableDatasetForm,
};

export function TestTableDatasetFormStory() {
  return <TableDatasetForm />;
}

export function TestControlledFormStory() {
  const [formData, setFormData] = React.useState(null);
  return <TableDatasetForm />;
}
