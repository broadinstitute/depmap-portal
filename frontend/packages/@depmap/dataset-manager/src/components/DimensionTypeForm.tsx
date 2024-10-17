import * as React from "react";
import { useState } from "react";
import validator from "@rjsf/validator-ajv8";
import Form from "@rjsf/core";
import { addDimensionTypeSchema } from "../models/addDimensionTypeSchema";
import { RJSFSchema, UiSchema } from "@rjsf/utils";
import { updateDimensionTypeSchema } from "../models/updateDimensionTypeSchema";
import { Dataset } from "@depmap/types";

interface DimensionTypeFormProps {
  onSubmit: (formData: any) => Promise<void>;
  dimensionTypeToEdit: any | null;
  isEditMode: boolean;
  datasets: Dataset[];
}

const uiSchema: UiSchema = {
  "ui:title": "", // removes the title <legend> html element,
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
    "ui:help":
      "This dataset contains metadata about your dimension type. At mininum one of the columns must match the ID Column of the dimension type and contain a column called 'label'.",
  },
  properties_to_index: {
    "ui:help":
      "Columns in the dataset file that you would like to index by or search by.",
  },
};

export default function DimensionTypeForm(props: DimensionTypeFormProps) {
  const { onSubmit, isEditMode, dimensionTypeToEdit, datasets } = props;
  const [editFormData, setEditFormData] = useState<any>(undefined);
  const [editSchema, setEditSchema] = useState<RJSFSchema | null>(null);
  const [submissionMsg, setSubmissionMsg] = useState<string | null>(null);
  const [hasError, setHasError] = useState<boolean>(false);

  React.useEffect(() => {
    if (isEditMode && dimensionTypeToEdit) {
      const dimensionTypeEditSchemaWithOptions = {
        ...updateDimensionTypeSchema,
        properties: {
          ...updateDimensionTypeSchema.properties,
          metadata_dataset_id: {
            ...(updateDimensionTypeSchema.properties
              .metadata_dataset_id as object),
            default: null, // must include default null with enum options otherwise UI renders 2 null options
            enum: [
              null,
              ...datasets.map((d) => {
                return d.id;
              }),
            ],
            enumNames: [
              "None",
              ...datasets.map((d) => {
                return d.name;
              }),
            ],
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
      setEditFormData(initForm);
    }
  }, [dimensionTypeToEdit, isEditMode, datasets]);

  const onSubmission = async ({ formData }: any) => {
    setSubmissionMsg("Loading...");
    // Refresh state at start of submission
    setHasError(false);
    try {
      await onSubmit(formData);
      setSubmissionMsg("Success!");
    } catch (e: any) {
      console.log(e);
      setHasError(true);
      if ("detail" in e) {
        setSubmissionMsg(e.detail as string);
      } else {
        setSubmissionMsg("An unknown error occurred!");
      }
    }
  };

  return isEditMode && editSchema ? (
    <>
      <Form
        formData={editFormData}
        onChange={(e) => {
          setEditFormData(e.formData);
          // Refresh message if form changes
          setSubmissionMsg(null);
        }}
        schema={editSchema}
        uiSchema={uiSchema}
        validator={validator}
        onSubmit={onSubmission}
      />
      <p
        style={{
          color: hasError ? "red" : "gray",
          paddingTop: "5px",
          fontStyle: "italic",
        }}
      >
        {submissionMsg}
      </p>
    </>
  ) : (
    <>
      <Form
        schema={addDimensionTypeSchema}
        uiSchema={uiSchema}
        validator={validator}
        onSubmit={onSubmission}
      />
      <p
        style={{
          color: hasError ? "red" : "gray",
          paddingTop: "5px",
          fontStyle: "italic",
        }}
      >
        {submissionMsg}
      </p>
    </>
  );
}
