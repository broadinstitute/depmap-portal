import { RJSFSchema } from "@rjsf/utils";

export const tableFormSchema: Required<Pick<RJSFSchema, "properties">> &
  RJSFSchema = {
  title: "TableDatasetParams",
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
      required: ["col_type"],
      type: "object",
      properties: {
        units: {
          title: "Units",
          type: "string",
          description: "Units for the values in the column, used for display",
        },
        col_type: {
          title: "Column Type",
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
      description: "The group the dataset belongs to",
      format: "uuid",
    },
    priority: {
      title: "Priority",
      minimum: 1,
      type: ["integer", "null"],
      description:
        "Numeric value representing priority of the dataset within its data type, with `1` being highest priority",
    },
    is_transient: {
      // TODO: This should be required param in bb
      title: "Is Transient",
      type: "boolean",
      description:
        "Transient datasets can be deleted - should only be set to true for non-public short-term-use datasets like custom analysis results.",
      default: false,
    },
    dataset_metadata: {
      title: "Dataset Metadata",
      type: ["object", "null"],
      description:
        "Additional dataset information that is not already provided in above form",
    },
    format: {
      title: "Format",
      enum: ["tabular"],
      type: "string",
      default: "tabular",
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
        "Information about each column in the dataset such as its type and any references",
    },
  },
};
