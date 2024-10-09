import { RJSFSchema } from "@rjsf/utils";

export const addDimensionTypeSchema: Required<Pick<RJSFSchema, "properties">> &
  RJSFSchema = {
  title: "AddDimensionType",
  required: ["name", "display_name", "id_column", "axis"],
  type: "object",
  properties: {
    name: {
      type: "string",
      title: "Name",
    },
    display_name: {
      type: "string", // bb typing is nullable for backwards compatibility but we want display name to be required
      title: "Display Name",
    },
    id_column: {
      type: "string",
      title: "Id Column",
    },
    axis: {
      type: "string",
      enum: ["feature", "sample"],
      title: "Axis",
    },
  },
};
