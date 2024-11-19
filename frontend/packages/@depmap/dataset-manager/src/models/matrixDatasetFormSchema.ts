import { RJSFSchema } from "@rjsf/utils";

export const matrixFormSchema: Required<Pick<RJSFSchema, "properties">> &
  RJSFSchema = {
  title: "MatrixDatasetParams",
  required: [
    "name",
    "file_ids",
    "dataset_md5",
    "data_type",
    "group_id",
    "format",
    "units",
    "sample_type",
    "value_type",
  ],
  type: "object",
  definitions: {
    ValueType: {
      title: "ValueType",
      enum: ["continuous", "categorical"],
      description: "An enumeration.",
    },
  },
  dependencies: {
    // defined dependencies for RJSF
    value_type: {
      oneOf: [
        {
          properties: {
            value_type: {
              enum: ["continuous"],
            },
          },
        },
        {
          properties: {
            value_type: {
              enum: ["categorical"],
            },
            allowed_values: {
              title: "Allowed Values",
              type: "array", // ["array", "null"], // 'null' in list means value is nullable
              uniqueItems: true, // figure out if there is way to add keyword in bb fastapi openapi.json
              items: {
                type: "string",
              },
              description:
                "Only provide if 'value_type' is 'categorical'. Must contain all possible categorical values",
              // default: null // this doesn't set default to null. BUG: (see: https://github.com/rjsf-team/react-jsonschema-form/issues/1581)
            },
          },
          required: ["allowed_values"],
        },
      ],
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
        "ID of the group the dataset belongs to. Required for non-transient datasets.",
      format: "uuid",
    },
    priority: {
      title: "Priority",
      minimum: 1, // not in openapi.json but added to solve exclusiveMinimum problem
      // exclusiveMinimum: 0, In openapi.json but RJSF not recognizing exclusiveMinimum and exclusiveMaximum keywords?
      type: ["integer", "null"], // "null" must be string or else it throws an error
      description:
        "Numeric value assigned to the dataset with `1` being highest priority within the `data_type`, used for displaying order of datasets to show for a specific `data_type` in UI.",
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
        "Contains a dictionary of additional dataset values that are not already provided above.",
    },
    format: {
      title: "Format",
      enum: ["matrix"],
      type: "string",
      default: "matrix",
    },
    units: {
      title: "Units",
      type: "string",
      description: "Units for the values in the dataset, used for display",
    },
    feature_type: {
      title: "Feature Type",
      type: ["string", "null"],
      description: "Type of features your dataset contains",
    },
    sample_type: {
      title: "Sample Type",
      type: "string",
      description: "Type of samples your dataset contains",
    },
    value_type: {
      allOf: [
        {
          $ref: "#/definitions/ValueType",
        },
      ],
      description:
        "Value 'continuous' if dataset contains numerical values or 'categorical' if dataset contains string categories as values.",
      //   nullable: false, // In openapi.json but RJSF gives error that 'nullable' can't be used without 'type'
    },
  },
};
