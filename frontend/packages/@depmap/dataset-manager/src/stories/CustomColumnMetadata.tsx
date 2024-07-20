import * as React from "react";
import Form from "@rjsf/core";
import validator from "@rjsf/validator-ajv8";
import {
  FieldProps,
  getTemplate,
  ObjectFieldTemplateProps,
  RegistryFieldsType,
  RJSFSchema,
  UiSchema,
} from "@rjsf/utils";

const schema: RJSFSchema = {
  required: ["columns_metadata"],
  type: "object",
  definitions: {
    AnnotationType: {
      enum: ["continuous", "categorical", "binary", "text", "list_strings"],
      description: "An enumeration.",
    },
    ColumnMetadata: {
      // "$id": "/schemas/ColumnMetadata", don't include with $refs?
      required: ["col_type"],
      type: "object",
      properties: {
        units: {
          title: "Units",
          type: "string",
          description: "Units for the values in the column, used for display",
          nullable: true,
        },
        col_type: {
          title: "Column Title",
          allOf: [
            {
              $ref: "#/definitions/AnnotationType",
            },
          ],
          description:
            "Annotation type for the column. Annotation types may include: `continuous`, `categorical`, `binary`, `text`, or `list_strings`.",
        },
        references: {
          title: "References",
          type: "string",
          description:
            "If specified, the value in this column is interpreted as an IDs in the named dimension type.",
          nullable: true,
        },
      },
    },
  },
  properties: {
    columns_metadata: {
      title: "Columns Metadata",
      type: "object",
      additionalProperties: {
        $ref: "#/definitions/ColumnMetadata",
      },
      description:
        "Dictionary containing info about each column in the table dataset format.",
    },
  },
};

const CustomObjectTemplate = function (props: ObjectFieldTemplateProps) {
  const { formData, schema, required, registry } = props;
  console.log(schema);
  // getTemplate returns a RJSF template by given name
  const ObjectTemplate = getTemplate("ObjectFieldTemplate", registry);

  return <ObjectTemplate {...props} />;
};

const CustomTextField2 = function (props: FieldProps) {
  const { title, schema, formData, onChange } = props;
  const [input, setInput] = React.useState<string>("");
  const handleInputChange = (e) => {
    const { value } = e.target;
    console.log(value);
    setInput(value);
    onChange(value);
  };
  console.log(title, schema, formData);
  console.log(input);

  return (
    <div id="custom">
      <b>{schema.title}</b>
      <textarea
        className="form-control"
        placeholder="{you&#10;me}"
        onChange={handleInputChange}
        value={input}
      />
    </div>
  );
};

function customValidate(formData, errors, uiSchema) {
  try {
    JSON.parse(formData.columns_metadata);
  } catch {
    errors.columns_metadata.addError("Cannot be parsed to JSON");
  }
  console.log(formData, errors, uiSchema);

  return errors;
}

function transformErrors(errors, uiSchema) {
  return errors.filter((error) => {
    console.log(error);
    if (!(error.property === ".columns_metadata" && error.name === "type")) {
      return error;
    }
  });
}

const fields: RegistryFieldsType = {
  // "/schemas/ColumnMetadata": CustomTextField
  JSONInput: CustomTextField2,
};

const uiSchema: UiSchema = {
  columns_metadata: {
    // "ui:field": "JSONInput",
    "ui:ObjectFieldTemplate": CustomObjectTemplate,
  },
};

export function ColumnMetadata() {
  const [formData, setFormData] = React.useState(null);

  const onSubmit = ({ formData }, e) => {
    console.log("Data submitted: ", formData, e);
  };
  const handleChange = (e, id) => {
    console.log(e, id);
    setFormData(e.formData);
  };

  console.log(formData);
  return (
    <Form
      schema={schema}
      formData={formData}
      onChange={handleChange}
      //   {(e) => setFormData(e.formData)}
      validator={validator}
      fields={fields}
      uiSchema={uiSchema}
      // customValidate={customValidate}
      //   transformErrors={transformErrors}
      onSubmit={onSubmit}
    />
  );
}
