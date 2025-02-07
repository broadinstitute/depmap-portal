import * as React from "react";
import Form from "@rjsf/core";
import {
  FieldProps,
  RegistryFieldsType,
  RJSFValidationError,
  UiSchema,
  RJSFSchema,
} from "@rjsf/utils";
import validator from "@rjsf/validator-ajv8";
import { matrixFormSchema } from "../models/matrixDatasetFormSchema";
import { CustomDatasetMetadata } from "./DatasetMetadataForm";
import { FormGroup, ControlLabel } from "react-bootstrap";
import {
  DataType,
  FeatureDimensionType,
  Group,
  InvalidPrioritiesByDataType,
  SampleDimensionType,
} from "@depmap/types";
import { Option, TagInput } from "@depmap/common-components";
import { ActionMeta, ValueType } from "react-select";

function transformErrors(errors: RJSFValidationError[]) {
  // eslint-disable-next-line array-callback-return, consistent-return
  const filteredErrors = errors.filter((error) => {
    if (
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

interface AllowedValuesInput {
  readonly inputValue: string;
  readonly valueOptions: readonly Option[];
  readonly allowedValues: string[];
}

const CustomAllowedValues = function (props: FieldProps) {
  const createOption = (label: string) => ({
    label,
    value: label,
  });
  const { onChange, schema, formData, required } = props;
  const [
    allowedValuesInputOptions,
    setAllowedValuesInputOptions,
  ] = React.useState<AllowedValuesInput>({
    inputValue: "",
    valueOptions: formData
      ? formData.map((val: any) => {
          return createOption(val);
        })
      : [],
    allowedValues: formData || [],
  });

  const handleAllowedValuesChange = (
    valueAfterAction: ValueType<Option, true>,
    actionMeta: ActionMeta<Option>
  ) => {
    console.log(actionMeta);
    console.log(valueAfterAction);
    const allowedValuesList = valueAfterAction
      ? valueAfterAction.map((option) => {
          return option.label;
        })
      : [];
    setAllowedValuesInputOptions({
      ...allowedValuesInputOptions,
      /* eslint-disable-next-line no-unneeded-ternary */
      valueOptions: valueAfterAction ? valueAfterAction : [],
      allowedValues: allowedValuesList,
    });
    onChange(allowedValuesList);
  };

  const handleAllowedValuesInputChange = (inputValue: string) => {
    setAllowedValuesInputOptions({
      ...allowedValuesInputOptions,
      inputValue,
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLElement>) => {
    if (!allowedValuesInputOptions.inputValue) return;
    const valuesArray = allowedValuesInputOptions.inputValue
      .split(",")
      .map((option) => option.trim());
    const valueOptions = valuesArray.map((val) => {
      return createOption(val);
    });
    switch (e.key) {
      case "Enter":
      case "Tab":
        setAllowedValuesInputOptions({
          inputValue: "",
          valueOptions: [
            ...allowedValuesInputOptions.valueOptions,
            ...valueOptions,
          ],
          allowedValues: [
            ...allowedValuesInputOptions.allowedValues,
            ...valuesArray,
          ],
        });
        onChange([...allowedValuesInputOptions.allowedValues, ...valuesArray]);
        e.preventDefault();
        break;
      default:
        console.log("Unrecognized key pressed");
    }
  };

  return (
    <FormGroup controlId="allowed_values">
      <ControlLabel>
        {schema.title}
        {required ? "*" : null}
      </ControlLabel>
      <TagInput
        inputValue={allowedValuesInputOptions.inputValue}
        value={allowedValuesInputOptions.valueOptions}
        onInputChange={handleAllowedValuesInputChange}
        onChange={handleAllowedValuesChange}
        onKeyDown={handleKeyDown}
        placeholder="Type value or comma-separated values (e.g. val1,val2) and press 'Enter' or 'Tab'"
      />
    </FormGroup>
  );
};

const fields: RegistryFieldsType = {
  TagInputMetadata: CustomDatasetMetadata,
  TagInputAllowedValues: CustomAllowedValues,
};

interface MatrixDatasetFormProps {
  featureTypes: FeatureDimensionType[];
  sampleTypes: SampleDimensionType[];
  dataTypes: DataType[];
  invalidDataTypePriorities: InvalidPrioritiesByDataType;
  groups: Group[];
  fileIds?: string[] | null;
  md5Hash?: string | null;
  initFormData: any;
  isAdvancedMode: boolean;
  onSubmitForm: (formData: { [key: string]: any }) => void;
  forwardFormData?: (formData: { [key: string]: any }) => void;
}

export function MatrixDatasetForm({
  featureTypes,
  sampleTypes,
  dataTypes,
  invalidDataTypePriorities,
  groups,
  fileIds = null,
  md5Hash = null,
  initFormData,
  isAdvancedMode,
  onSubmitForm,
  forwardFormData = undefined,
}: MatrixDatasetFormProps) {
  const [formData, setFormData] = React.useState(initFormData);
  const [schema, setSchema] = React.useState<RJSFSchema | null>(null);

  const uiSchema = React.useMemo(() => {
    const formUiSchema: UiSchema = {
      "ui:title": "", // removes the title <legend> html element
      "ui:order": [
        "name",
        "file_ids",
        "dataset_md5",
        "units",
        "feature_type",
        "sample_type",
        "group_id",
        "value_type",
        "allowed_values",
        "data_type",
        "priority",
        "dataset_metadata",
        "is_transient",
        "format",
      ],
      dataset_metadata: {
        "ui:field": "TagInputMetadata",
      },
      allowed_values: {
        "ui:field": "TagInputAllowedValues",
        // "ui:emptyValue": null // This doesn't make default val 'null'. BUG: (see: https://github.com/rjsf-team/react-jsonschema-form/issues/1581                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             )
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
    if (!isAdvancedMode) {
      [
        "feature_type",
        "value_type",
        "priority",
        "dataset_metadata",
        "data_type",
      ].forEach((key) => {
        formUiSchema[key] = { "ui:widget": "hidden" };
      });
    }
    return formUiSchema;
  }, [isAdvancedMode]);

  React.useEffect(() => {
    const featureTypeOptions = featureTypes.map((option) => {
      return option.name;
    });

    const sampleTypeOptions = sampleTypes.map((option) => {
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
      ...matrixFormSchema,
      properties: {
        ...matrixFormSchema.properties,
        feature_type: {
          ...(matrixFormSchema.properties.feature_type as object),
          default: null,
          enum: [null, ...featureTypeOptions],
          enumNames: ["None"].concat(featureTypeOptions),
        },
        sample_type: {
          ...(matrixFormSchema.properties.sample_type as object),
          oneOf: sampleTypeOptions,
        },
        data_type: {
          ...(matrixFormSchema.properties.data_type as object),
          oneOf: dataTypeOptions,
        },
        group_id: {
          ...(matrixFormSchema.properties.group_id as object),
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

  const handleOnChange = (e: any) => {
    // Need to set allowed_values with continuous value_type back to null if value_type switches from categorical
    if (
      e.formData.value_type === "continuous" &&
      e.formData.allowed_values !== null
    ) {
      setFormData({ ...e.formData, allowed_values: null });
      if (forwardFormData !== undefined) {
        forwardFormData({ ...e.formData, allowed_values: null });
      }
    } else {
      setFormData(e.formData);
      if (forwardFormData !== undefined) {
        forwardFormData(e.formData);
      }
    }
  };

  function customValidate(formDataToValidate: any, errors: any) {
    if (
      formDataToValidate.value_type === "categorical" &&
      !formDataToValidate.allowed_values
    ) {
      errors.allowed_values.addError(
        "must include Allowed Values for matrix if Value Type is 'categorical'!"
      );
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

  console.log(formData);

  return schema ? (
    <Form
      formData={formData}
      onChange={handleOnChange}
      schema={schema}
      validator={validator}
      uiSchema={uiSchema}
      fields={fields}
      customValidate={customValidate}
      // eslint-disable-next-line @typescript-eslint/no-shadow
      onSubmit={({ formData }) => {
        onSubmitForm(formData);
      }}
      transformErrors={transformErrors}
    />
  ) : null;
}
