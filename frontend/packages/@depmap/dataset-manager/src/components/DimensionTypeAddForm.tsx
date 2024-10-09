import * as React from "react";

import validator from "@rjsf/validator-ajv8";
import Form from "@rjsf/core";
import { addDimensionTypeSchema } from "../models/addDimensionTypeSchema";
import { UiSchema } from "@rjsf/utils";

const uiSchema: UiSchema = {
  "ui:title": "", // removes the title <legend> html element
  id_column: {
    "ui:help":
      "Identifier name for the dimension type. Ex: For sample type gene, the identifier is entrez_id. entrez_id must then be a column in the metadata file.",
  },
  axis: {
    "ui:help":
      "Dimensions are either feature or sample. When used in a matrix dataset, features are oriented as columns and samples are oriented as rows.",
  },
};

export default function DimensionTypeAddForm() {
  return (
    <Form
      schema={addDimensionTypeSchema}
      uiSchema={uiSchema}
      validator={validator}
      onSubmit={async ({ formData }) => {
        console.log(formData);
      }}
    />
  );
}
