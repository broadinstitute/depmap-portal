import * as React from "react";
import Form from "@rjsf/core";
import { RegistryFieldsType, UiSchema, RJSFSchema } from "@rjsf/utils";
import validator from "@rjsf/validator-ajv8";
import { matrixUpdateFormSchema } from "../models/matrixUpdateDatasetFormSchema";
import { CustomDatasetMetadata } from "./DatasetMetadataForm";
import { Dataset, DataType, Group } from "@depmap/types";

interface MatrixUpdateDatasetFormProps {
  dataTypes: DataType[];
  groups: Group[];
  datasetToUpdate: Dataset;
  onSubmitForm: (formData: { [key: string]: any }) => void;
}
const fields: RegistryFieldsType = {
  TagInputMetadata: CustomDatasetMetadata,
};

const uiSchema: UiSchema = {
  "ui:title": "", // removes the title <legend> html element
  dataset_metadata: {
    "ui:field": "TagInputMetadata",
  },
  format: {
    "ui:widget": "hidden",
  },
  group_id: {
    "ui:title": "Group", // override original title from schema
  },
};

export function MatrixUpdateDatasetForm({
  dataTypes,
  groups,
  datasetToUpdate,
  onSubmitForm,
}: MatrixUpdateDatasetFormProps) {
  // const [formData, setFormData] = React.useState(null);
  const [schema, setSchema] = React.useState<RJSFSchema>(
    matrixUpdateFormSchema
  );

  React.useEffect(() => {
    const dataTypeOptions = dataTypes?.map((option) => {
      return { title: option.name, const: option.name };
    });
    const groupOptions = groups.map((option) => {
      return { title: option.name, const: option.id };
    });
    // Update schema with dropdown options retrieved from bbapi
    const schemaWithOptions = {
      ...matrixUpdateFormSchema,
      properties: {
        ...matrixUpdateFormSchema.properties,
        data_type: {
          ...(matrixUpdateFormSchema.properties?.data_type as object),
          oneOf: dataTypeOptions,
        },
        group_id: {
          ...(matrixUpdateFormSchema.properties?.group_id as object),
          oneOf: groupOptions,
        },
      },
    };
    setSchema(schemaWithOptions);
  }, [dataTypes, groups]);

  return (
    <Form
      schema={schema}
      uiSchema={uiSchema}
      validator={validator}
      fields={fields}
      onSubmit={({ formData }) => {
        console.log(formData);
      }}
    />
  );
}
