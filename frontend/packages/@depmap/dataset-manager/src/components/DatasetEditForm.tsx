import * as React from "react";
import { matrixUpdateFormSchema } from "../models/matrixUpdateDatasetFormSchema";
import { tabularUpdateFormSchema } from "../models/tabularUpdateDatasetFormSchema";
import { useState, useEffect } from "react";
import {
  Dataset,
  DatasetUpdateArgs,
  DataType,
  Group,
  InvalidPrioritiesByDataType,
} from "@depmap/types";
import { RegistryFieldsType, RJSFSchema, UiSchema } from "@rjsf/utils";
import validator from "@rjsf/validator-ajv8";
import { CustomDatasetMetadata } from "./DatasetMetadataForm";
import Form from "@rjsf/core";

interface DatasetEditFormProps {
  getDataTypesAndPriorities: () => Promise<InvalidPrioritiesByDataType>;
  getGroups: () => Promise<Group[]>;
  datasetToEdit: Dataset;
  updateDataset: (
    datasetId: string,
    datasetToUpdate: DatasetUpdateArgs
  ) => Promise<Dataset>;
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

export default function DatasetForm(props: DatasetEditFormProps) {
  const {
    getDataTypesAndPriorities,
    getGroups,
    datasetToEdit,
    updateDataset,
  } = props;

  const [schema, setSchema] = useState<RJSFSchema | null>(null);
  const [formDataVals, setFormDataVals] = useState<any>(null);
  console.log(formDataVals);

  console.log(datasetToEdit);

  useEffect(() => {
    (async () => {
      try {
        const [dataTypesPriorities, groups] = await Promise.all([
          getDataTypesAndPriorities(),
          getGroups(),
        ]);

        const dataTypeOptions = Object.keys(dataTypesPriorities).map(
          (dType) => {
            return {
              title: dType,
              const: dType,
            };
          }
        );
        const groupOptions = groups.map((option) => {
          return { title: option.name, const: option.id };
        });

        let formSchema: Required<Pick<RJSFSchema, "properties">> & RJSFSchema;
        if (datasetToEdit.format === "matrix_dataset") {
          formSchema = matrixUpdateFormSchema;
        }
        // eslint-disable-next-line no-else-return
        else {
          formSchema = tabularUpdateFormSchema;
        }

        // Update schema with dropdown options retrieved from bbapi
        const schemaWithOptions = {
          ...formSchema,
          properties: {
            ...formSchema.properties,
            data_type: {
              ...(formSchema.properties.data_type as object),
              oneOf: dataTypeOptions,
            },
            group_id: {
              ...(formSchema.properties.group_id as object),
              oneOf: groupOptions,
            },
          },
        };

        const initForm: { [key: string]: any } = {};
        Object.keys(formSchema.properties).forEach((key) => {
          if (key in datasetToEdit) {
            if (key === "format") {
              initForm[key] = datasetToEdit[key].replace("_dataset", "");
            } else {
              initForm[key] = datasetToEdit[key];
            }
          }
        });

        setSchema(schemaWithOptions);
        setFormDataVals(initForm);
      } catch (e) {
        console.error(e);
      }
    })();
  }, [getGroups, getDataTypesAndPriorities, datasetToEdit]);

  return schema ? (
    <Form
      formData={formDataVals}
      schema={schema}
      uiSchema={uiSchema}
      validator={validator}
      fields={fields}
      onSubmit={async ({ formData }) => {
        console.log(formData);
        await updateDataset(datasetToEdit.id, formData);
      }}
    />
  ) : null;
}
