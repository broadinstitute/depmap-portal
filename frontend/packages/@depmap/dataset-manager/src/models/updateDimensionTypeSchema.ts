import { RJSFSchema } from "@rjsf/utils";

export const UpdateDimensionType: Required<Pick<RJSFSchema, "properties">> &
  RJSFSchema = {
  title: "UpdateDimensionType",
  type: "object",
  properties: {
    display_name: {
      type: ["string", "null"],
      title: "Display Name",
    },
    metadata_dataset_id: {
      type: ["string", "null"],
      format: "uuid",
      title: "Metadata Dataset Id",
    },
    properties_to_index: {
      type: ["array", "null"],
      items: {
        type: "string",
      },
      title: "Properties To Index",
    },
  },
};
