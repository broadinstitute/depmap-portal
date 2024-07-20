import * as React from "react";
// import { createRoot } from 'react-dom/client';
// import ReactDOM from "react-dom";

import Form from "@rjsf/core";
import {
  RJSFSchema,
  FieldProps,
  RegistryFieldsType,
  RegistryWidgetsType,
  WidgetProps,
  UiSchema,
  TitleFieldProps,
} from "@rjsf/utils";
import validator from "@rjsf/validator-ajv8";
import { ArrayFieldTemplateProps, ArrayFieldTitleProps } from "@rjsf/utils";

const CustomIdField = function (props: FieldProps) {
  return (
    <div id="custom">
      <p>Yeah, Im pretty dumb.</p>
      <div>My props are: {props.toString()}</div>
    </div>
  );
};

function CustomArrayFieldTitleTemplate(props: TitleFieldProps) {
  const { className, title, required } = props;
  return (
    <div className={className}>
      <b>
        {title}
        {required ? "*" : null}
      </b>
    </div>
  );
}

function CustomArrayFieldTemplate(props: ArrayFieldTemplateProps) {
  const { className, items, canAdd, onAddClick } = props;
  return (
    <div className={className}>
      {items &&
        items.map((element) => (
          <div key={element.key} className={element.className}>
            <div>{element.children}</div>
            {element.hasMoveDown && (
              <button
                type="button"
                onClick={element.onReorderClick(
                  element.index,
                  element.index + 1
                )}
              >
                Down
              </button>
            )}
            {element.hasMoveUp && (
              <button
                type="button"
                onClick={element.onReorderClick(
                  element.index,
                  element.index - 1
                )}
              >
                Up
              </button>
            )}
            <button
              type="button"
              onClick={element.onDropIndexClick(element.index)}
            >
              Delete
            </button>
            <hr />
          </div>
        ))}

      {canAdd && (
        <div className="row">
          <p className="col-xs-3 col-xs-offset-9 array-item-add text-right">
            <button onClick={onAddClick} type="button">
              Custom +
            </button>
          </p>
        </div>
      )}
      <p> OHOHOH</p>
    </div>
  );
}

const CustomArraySchemaField = function (props: FieldProps) {
  const { index, registry } = props;
  const { SchemaField } = registry.fields;
  console.log("registy: ", registry);
  console.log("props: ", props);
  const name = `Index ${index}`;
  const title = `File Id ${index + 1}`;
  return (
    <>
      <SchemaField {...props} name={name} title={title}>
        PPP
      </SchemaField>
      <p> UGGGH</p>
    </>
  );
};

const templates: Partial<TemplatesType> = {
  // ArrayFieldTemplate: CustomArrayFieldTemplate,
  // FieldTemplate: CustomFieldTemplate,
  // ObjectFieldTemplate: CustomObjectFieldTemplate,
  // ErrorFieldTemplate: CustomErrorField,
  ArrayFieldTitleTemplate: CustomArrayFieldTitleTemplate,
};

const fields: RegistryFieldsType = {
  // '/schemas/specialString': CustomIdField,
  ArraySchemaField: CustomArraySchemaField,
};

const schema: RJSFSchema = {
  title: "Table Dataset form",
  required: [
    "name",
    "file_ids",
    "dataset_md5",
    "data_type",
    "group_id",
    "format",
    "index_type",
    "columns_metadata",
  ],
  type: "object",
  definitions: {
    AnnotationType: {
      enum: ["continuous", "categorical", "binary", "text", "list_strings"],
      description: "An enumeration.",
    },
    ColumnMetadata: {
      $id: "/schemas/ColumnMetadata",
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
    name: {
      title: "Name",
      minLength: 1,
      type: "string",
      description: "Name of dataset",
    },
    file_ids: {
      title: "File Ids",
      type: "array",
      items: {
        type: "string",
      },
      description: "Ordered list of file ids from the chunked dataset uploads",
    },
    dataset_md5: {
      title: "Dataset Md5",
      maxLength: 32,
      minLength: 32,
      type: "string",
      description: "MD5 hash for entire dataset file",
    },
    data_type: {
      title: "Data Type",
      type: "string",
      description: "Data type grouping for your dataset",
    },
    group_id: {
      title: "Group Id",
      type: "string",
      description:
        "ID of the group the dataset belongs to. Required for non-transient datasets. The public group is `00000000-0000-0000-0000-000000000000`",
      format: "uuid",
    },
    priority: {
      title: "Priority",
      exclusiveMinimum: 0,
      type: "integer",
      description:
        "Numeric value assigned to the dataset with `1` being highest priority within the `data_type`, used for displaying order of datasets to show for a specific `data_type` in UI.",
      nullable: true,
    },
    taiga_id: {
      title: "Taiga Id",
      type: "string",
      description: "Taiga ID the dataset is sourced from.",
      nullable: true,
    },
    is_transient: {
      title: "Is Transient",
      type: "boolean",
      description:
        "Transient datasets can be deleted - should only be set to true for non-public short-term-use datasets like custom analysis results.",
      default: false,
      nullable: false,
    },
    dataset_metadata: {
      title: "Dataset Metadata",
      type: "object",
      description:
        "Contains a dictionary of additional dataset values that are not already provided above.",
      nullable: true,
    },
    format: {
      title: "Format",
      enum: ["tabular"],
      type: "string",
    },
    index_type: {
      title: "Index Type",
      type: "string",
      description:
        "Feature type or sample type name that is used as index in the table dataset format. Used to validate the identifier of the dimension type is included in the dataset.",
    },
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

const CustomCheckbox = function (props: WidgetProps) {
  return (
    <button
      id="custom"
      type="button"
      className={props.value ? "checked" : "unchecked"}
      onClick={() => props.onChange(!props.value)}
    >
      {String(props.value)}
    </button>
  );
};

const widgets: RegistryWidgetsType = {
  CheckboxWidget: CustomCheckbox,
};

const uiSchema: UiSchema = {
  // 'ui:widget': 'checkbox'
  // name: {
  //     'ui:classNames': 'custom-class-name',
  // },
  // age: {
  // 'ui:classNames': 'custom-class-age',
  // },
};

export function TableDatasetForm() {
  return (
    <Form
      schema={schema}
      validator={validator}
      uiSchema={uiSchema}
      widgets={widgets}
      fields={fields}
      templates={templates}
    />
  );
}
