import * as React from "react";

import Form from "@rjsf/core";
import {
  RJSFSchema,
  FieldProps,
  RegistryFieldsType,
  UiSchema,
  RJSFValidationError,
} from "@rjsf/utils";
import validator from "@rjsf/validator-ajv8";
import { tableFormSchema } from "../models/tableDatasetFormSchema";
import DatasetMetadataForm from "./DatasetMetadataForm";
import { FormGroup, FormControl, ControlLabel } from "react-bootstrap";
import {
  DataType,
  FeatureType,
  Group,
  InvalidPrioritiesByDataType,
  SampleType,
} from "@depmap/types";

// TODO: copied from MatrixDatasetForm
const CustomDatasetMetadata = function (props: FieldProps) {
  const { onChange } = props;

  return (
    <div id="customDatasetMetadata">
      <DatasetMetadataForm
        isEdit={false} // TODO: Unhardcode
        forwardDatasetMetadataDict={(metadataDict: {
          [key: string]: string;
        }) => {
          onChange(metadataDict);
        }}
      />
    </div>
  );
};

const CustomColumnsMetadata = function (props: FieldProps) {
  const { schema, onChange, required } = props;
  const [input, setInput] = React.useState<string>("");
  const handleInputChange = (e: any) => {
    const { value } = e.target;

    setInput(value);
    onChange(value);
  };

  return (
    <FormGroup controlId="columnsMetadata">
      <ControlLabel>
        {schema.title}
        {required ? "*" : null}
      </ControlLabel>
      <p>{schema.description}</p>
      <FormControl
        name="columns_metadata"
        componentClass="textarea"
        rows={5}
        placeholder='{&#10;"id_col_name": {"col_type": "text"},&#10;col_2_name: {"units": "uM", "col_type": "continuous", "references": null},&#10;col_3_name: {"col_type": "categorical"}&#10;}'
        value={input}
        onChange={handleInputChange}
        required={required}
      />
    </FormGroup>
  );
};

const fields: RegistryFieldsType = {
  TagInputMetadata: CustomDatasetMetadata,
  JSONInputColumns: CustomColumnsMetadata,
};

const uiSchema: UiSchema = {
  "ui:title": "", // removes the title <legend> html element
  "ui:order": [
    "name",
    "file_ids",
    "dataset_md5",
    "index_type",
    "columns_metadata",
    "group_id",
    "data_type",
    "priority",
    "dataset_metadata",
    "is_transient",
    "format",
  ],
  dataset_metadata: {
    "ui:field": "TagInputMetadata",
  },
  columns_metadata: {
    "ui:field": "JSONInputColumns",
  },
  format: {
    "ui:widget": "hidden",
  },
  file_ids: {
    "ui:widget": "hidden",
  },
  dataset_md5: {
    "ui:widget": "hidden",
  },
  is_transient: {
    "ui:widget": "hidden",
  },
  group_id: {
    "ui:title": "Group", // override original title from schema
  },
};

function transformErrors(errors: RJSFValidationError[]) {
  // Override list of errors returned to not include check for column_metadata value to be an object.
  // Since we are making the value a JSON string, checking if value is object would cause error to appear
  // eslint-disable-next-line array-callback-return, consistent-return
  const filteredErrors = errors.filter((error) => {
    if (
      !(
        error.property === ".columns_metadata" &&
        error.name === "type" &&
        error.message === "must be object"
      ) &&
      !(
        // Override list of errors returned to not include file_ids since unable to recognize null value
        // Below error to check dataset_md5 will be used to confirm file upload is provided
        (
          error.property === ".file_ids" &&
          error.name === "type" &&
          error.message === "must be array"
        )
      )
    ) {
      return error;
    }
  });
  const newErrors = filteredErrors.map((error) => {
    if (
      error.property === ".dataset_md5" &&
      error.name === "type" &&
      error.message === "must be string"
    ) {
      const newError = { ...error };
      newError.message = "Valid file must be included";
      newError.stack = "Valid file must be included!";
      return newError;
    }
    return error;
  });
  return newErrors;
}

function isObject(x: any) {
  return x && typeof x === "object" && !Array.isArray(x);
}

interface TableDatasetFormProps {
  featureTypes: FeatureType[];
  sampleTypes: SampleType[];
  dataTypes: DataType[];
  invalidDataTypePriorities: InvalidPrioritiesByDataType;
  groups: Group[];
  fileIds?: string[] | null;
  md5Hash?: string | null;
  initFormData: any;
  onSubmitForm: (formData: { [key: string]: any }) => void;
  forwardFormData?: (formData: { [key: string]: any }) => void;
}

export function TableDatasetForm({
  featureTypes,
  sampleTypes,
  dataTypes,
  invalidDataTypePriorities,
  groups,
  fileIds = null,
  md5Hash = null,
  initFormData,
  onSubmitForm,
  forwardFormData = undefined,
}: TableDatasetFormProps) {
  const [formData, setFormData] = React.useState(initFormData);
  const [schema, setSchema] = React.useState<RJSFSchema | null>(null);

  React.useEffect(() => {
    const indexOptions = featureTypes.concat(sampleTypes).map((option) => {
      return { title: option.name, const: option.name };
    });
    const dataTypeOptions = dataTypes.map((option) => {
      return { title: option.name, const: option.name };
    });
    const groupOptions = groups.map((option) => {
      return { title: option.name, const: option.id };
    });
    // Update schema with dropdown options retrieved from bbapi
    const schemaWithOptions = {
      ...tableFormSchema,
      properties: {
        ...tableFormSchema.properties,
        index_type: {
          ...(tableFormSchema.properties.index_type as object),
          oneOf: indexOptions,
        },
        data_type: {
          ...(tableFormSchema.properties.data_type as object),
          oneOf: dataTypeOptions,
        },
        group_id: {
          ...(tableFormSchema.properties.group_id as object),
          oneOf: groupOptions,
        },
      },
    };
    setSchema(schemaWithOptions);
  }, [featureTypes, sampleTypes, dataTypes, groups]);

  React.useEffect(() => {
    if (fileIds !== formData.file_ids || md5Hash !== formData.dataset_md5) {
      const newFormData = {
        ...formData,
        file_ids: fileIds,
        dataset_md5: md5Hash,
      };
      setFormData(newFormData);
    }
  }, [fileIds, md5Hash, formData]);

  function customValidate(formDataToValidate: any, errors: any) {
    let jsonParsed;
    try {
      jsonParsed = JSON.parse(formDataToValidate.columns_metadata);
    } catch {
      errors.columns_metadata.addError("cannot be parsed to JSON");
    }

    const errorNotObjMessage = "must be object! Please see example!";

    if (isObject(jsonParsed)) {
      // Make sure column names in columns_metadata
      const colKeys = Object.keys(jsonParsed);
      if (colKeys.length === 0) {
        errors.columns_metadata.addError(
          "must include column names of dataset"
        );
      }

      const invalidColMetadataKeysMsg =
        "must include at least 'col_type' key in column metadata. Other valid keys include 'units' and 'references'.";
      const acceptedColMetadataKeys = new Set([
        "units",
        "col_type",
        "references",
      ]);
      // make sure each column metadata content is valid
      let existingObjError = false;
      let existingBadColMetaKeysError = false;
      Object.values(jsonParsed).forEach((val: any) => {
        const colMetdataKeys = Object.keys(val);

        if (isObject(val) && colMetdataKeys.length !== 0) {
          const columnMetadataKeys = new Set(colMetdataKeys);
          // eslint-disable-next-line @typescript-eslint/ban-ts-comment
          // @ts-ignore
          const keyDifferences = columnMetadataKeys.difference(
            acceptedColMetadataKeys
          );
          // If at least one error for invalid column metadata keys exist, don't add to list of errors. This keeps list of errors shorter
          if (keyDifferences.size > 0 || !columnMetadataKeys.has("col_type")) {
            if (!existingBadColMetaKeysError) {
              errors.columns_metadata.addError(
                `'${JSON.stringify(val)}' ${invalidColMetadataKeysMsg}`
              );
              existingBadColMetaKeysError = true;
            }
          }
        } else {
          // If at least one column metadata has error where it's not an object, don't add to list of errors. This keeps list of errors shorter.
          // eslint-disable-next-line no-lonely-if
          if (!existingObjError) {
            errors.columns_metadata.addError(`'${val}' ${errorNotObjMessage}`);
            existingObjError = true;
          }
        }
      });
    } else {
      errors.columns_metadata.addError(errorNotObjMessage);
    }

    const formDataType = formDataToValidate.data_type;
    const formPriority = formDataToValidate.priority;
    if (invalidDataTypePriorities[formDataType].includes(formPriority)) {
      errors.priority.addError(
        `Priority of ${formPriority} already exists for data type ${formDataType}!`
      );
    }
    return errors;
  }

  return schema ? (
    <Form
      formData={formData}
      onChange={(e) => {
        setFormData(e.formData);
        if (forwardFormData !== undefined) {
          forwardFormData(e.formData);
        }
      }}
      schema={schema}
      validator={validator}
      uiSchema={uiSchema}
      fields={fields}
      customValidate={customValidate}
      transformErrors={transformErrors}
      // eslint-disable-next-line @typescript-eslint/no-shadow
      onSubmit={({ formData }) => {
        onSubmitForm(formData);
      }}
    />
  ) : null;
}
