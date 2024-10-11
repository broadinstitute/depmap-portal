import * as React from "react";
import { useState } from "react";

import validator from "@rjsf/validator-ajv8";
import Form from "@rjsf/core";
import { addDimensionTypeSchema } from "../models/addDimensionTypeSchema";
import { RJSFSchema, UiSchema } from "@rjsf/utils";
import { updateDimensionTypeSchema } from "../models/updateDimensionTypeSchema";
import {
  Dataset,
  DimensionTypeAddArgs,
  DimensionTypeUpdateArgs,
} from "@depmap/types";

interface DimensionTypeAddFormProps {
  addDimensionType: (args: DimensionTypeAddArgs) => void;
  updateDimensionType: (name: string, args: DimensionTypeUpdateArgs) => void;
  dimensionTypeToEdit: any | null;
  isEditMode: boolean;
  datasets: Dataset[];
}

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
  metadata_dataset_id: {
    "ui:title": "Dataset Metadata",
    "ui:emptyValue": null,
    "ui:help":
      "This dataset contains metadata about your dimension type. At mininum one of the columns must match the ID Column of the dimension type and contain a column called 'label'.",
  },
  properties_to_index: {
    "ui:help":
      "Columns in the dataset file that you would like to index by or search by.",
  },
};

export default function DimensionTypeFormV2(props: DimensionTypeAddFormProps) {
  const {
    addDimensionType,
    updateDimensionType,
    isEditMode,
    dimensionTypeToEdit,
    datasets,
  } = props;
  const [editFormData, setEditFormData] = useState<any>(undefined);
  const [editSchema, setEditSchema] = useState<RJSFSchema | null>(null);

  React.useEffect(() => {
    if (isEditMode && dimensionTypeToEdit) {
      const datasetOptions: {
        title: string | undefined;
        const: string | undefined;
      }[] = datasets.map((d) => {
        return { title: d.name, const: d.id };
      });
      // include value to give to form data for unchosen options
      datasetOptions.push({ title: undefined, const: undefined });

      const dimensionTypeEditSchemaWithOptions = {
        ...updateDimensionTypeSchema,
        properties: {
          ...updateDimensionTypeSchema.properties,
          metadata_dataset_id: {
            ...(updateDimensionTypeSchema.properties
              .metadata_dataset_id as object),
            oneOf: datasetOptions,
          },
        },
      };
      setEditSchema(dimensionTypeEditSchemaWithOptions);

      // initialize form with selected dataset existing fields
      const initForm: { [key: string]: any } = {};
      Object.keys(updateDimensionTypeSchema.properties).forEach((key) => {
        if (key in dimensionTypeToEdit) {
          initForm[key] = dimensionTypeToEdit[key];
        }
      });
      console.log("dim tupe: ", dimensionTypeToEdit);
      setEditFormData(initForm);
    }
  }, [dimensionTypeToEdit, isEditMode, datasets]);
  console.log(editFormData);

  return isEditMode && editSchema ? (
    <Form
      formData={editFormData}
      onChange={(e) => {
        setEditFormData(e.formData);
      }}
      schema={editSchema}
      uiSchema={uiSchema}
      validator={validator}
      onSubmit={async ({ formData }) => {
        console.log(formData);
        updateDimensionType(dimensionTypeToEdit.name, formData);
      }}
    />
  ) : (
    <Form
      schema={addDimensionTypeSchema}
      uiSchema={uiSchema}
      validator={validator}
      onSubmit={async ({ formData }) => {
        console.log(formData);
        addDimensionType(formData);
      }}
    />
  );
}
