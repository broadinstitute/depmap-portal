import { RJSFSchema } from "@rjsf/utils";

export const matrixUpdateFormSchema: Required<Pick<RJSFSchema, "properties">> &
  RJSFSchema = {
  title: "MatrixDatasetUpdateParams",
  required: ["format"],
  type: "object",
  properties: {
    name: {
      type: ["string", "null"],
      title: "Name",
      description: "Name of dataset",
    },
    data_type: {
      type: ["string", "null"],
      title: "Data Type",
      description: "Data type grouping for your dataset",
    },
    group_id: {
      type: ["string", "null"],
      format: "uuid",
      title: "Group Id",
      description: "Id of the group the dataset belongs to",
    },
    priority: {
      type: ["integer", "null"],
      title: "Priority",
      description:
        "Numeric value representing priority of the dataset within its `data_type`",
    },
    dataset_metadata: {
      type: ["object", "null"],
      title: "Dataset Metadata",
      description:
        "A dictionary of additional dataset metadata that is not already provided",
    },
    format: {
      type: "string",
      enum: ["matrix"],
      const: "matrix",
      title: "Format",
      default: "matrix",
    },
    units: {
      type: ["string", "null"],
      title: "Units",
      description: "Units for the values in the dataset",
    },
  },
};
