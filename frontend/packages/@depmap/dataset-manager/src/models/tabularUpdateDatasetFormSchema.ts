import { RJSFSchema } from "@rjsf/utils";

export const tabularUpdateFormSchema: Required<Pick<RJSFSchema, "properties">> &
  RJSFSchema = {
  title: "TabularDatasetUpdateParams",
  type: "object",
  properties: {
    name: {
      type: "string",
      title: "Name",
      description: "Name of dataset",
    },
    data_type: {
      type: "string",
      title: "Data Type",
      description: "Data type grouping for your dataset",
    },
    group_id: {
      type: "string",
      format: "uuid",
      title: "Group Id",
      description: "The group the dataset belongs to",
    },
    priority: {
      type: ["integer", "null"],
      title: "Priority",
      description:
        "Numeric value representing priority of the dataset within its data type, with `1` being highest priority",
    },
    dataset_metadata: {
      type: ["object", "null"],
      title: "Dataset Metadata",
      description:
        "Additional dataset information that is not already provided in above form",
    },
    format: {
      type: "string",
      enum: ["tabular"],
      const: "tabular",
      title: "Format",
      default: "tabular",
    },
  },
};
