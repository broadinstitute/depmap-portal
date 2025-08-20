import * as React from "react";
import { matrixUpdateFormSchema } from "../models/matrixUpdateDatasetFormSchema";
import { tabularUpdateFormSchema } from "../models/tabularUpdateDatasetFormSchema";
import { useState, useEffect } from "react";
import {
  Dataset,
  DatasetUpdateArgs,
  ErrorTypeError,
  Group,
  InvalidPrioritiesByDataType,
} from "@depmap/types";
import { RegistryFieldsType, RJSFSchema, UiSchema } from "@rjsf/utils";
import validator from "@rjsf/validator-ajv8";
import { CustomDatasetMetadata } from "./DatasetMetadataForm";
import Form from "@rjsf/core";
import { submitButtonIsDisabled } from "../../utils/disableSubmitButton";

interface DatasetEditFormProps {
  getDataTypesAndPriorities: () => Promise<InvalidPrioritiesByDataType>;
  groups: Group[];
  datasetToEdit: Dataset;
  onSubmit: (
    datasetId: string,
    datasetToUpdate: DatasetUpdateArgs
  ) => Promise<void>;
}

const fields: RegistryFieldsType = {
  TagInputMetadata: CustomDatasetMetadata,
};

export default function DatasetForm(props: DatasetEditFormProps) {
  const { getDataTypesAndPriorities, groups, datasetToEdit, onSubmit } = props;

  const [schema, setSchema] = useState<RJSFSchema | null>(null);
  const [formDataVals, setFormDataVals] = useState<any>(null);
  const [submissionMsg, setSubmissionMsg] = useState<string | null>(null);
  const [hasError, setHasError] = useState<boolean>(false);
  console.log(formDataVals);

  console.log(datasetToEdit);

  useEffect(() => {
    (async () => {
      try {
        const dataTypesPriorities = await getDataTypesAndPriorities();

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
              initForm[key] = datasetToEdit[key as keyof Dataset];
            }
          }
        });

        setSchema(schemaWithOptions);
        setFormDataVals(initForm);
      } catch (e) {
        console.error(e);
      }
    })();
  }, [groups, getDataTypesAndPriorities, datasetToEdit]);

  const uiSchema = React.useMemo(() => {
    const formUiSchema: UiSchema = {
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
      "ui:submitButtonOptions": {
        props: {
          disabled: submitButtonIsDisabled(schema?.required, formDataVals),
        },
      },
    };
    return formUiSchema;
  }, [formDataVals, schema?.required]);

  return schema && formDataVals ? (
    <>
      <Form
        formData={formDataVals}
        schema={schema}
        uiSchema={uiSchema}
        validator={validator}
        fields={fields}
        onSubmit={async ({ formData }) => {
          console.log(formData);
          setSubmissionMsg("Loading...");
          setHasError(false);
          try {
            await onSubmit(datasetToEdit.id, formData);
            setSubmissionMsg("SUCCESS!");
          } catch (e) {
            console.error(e);
            setHasError(true);
            if (e instanceof ErrorTypeError) {
              setSubmissionMsg(e.message);
            } else {
              setSubmissionMsg("An unknown error occurred!");
            }
          }
        }}
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
  ) : null;
}
