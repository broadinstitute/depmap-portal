import { ModelConfigOut } from "@depmap/types";

// One fixed color per position in the (dynamic) model-config sequence, so
// coloring stays consistent between the aggregate chart, the top-features
// bar chart, and (in a later phase) the model accordion headers.
const MODEL_COLORS = [
  "#6554c0",
  "#00b8d9",
  "#36b37e",
  "#ffab00",
  "#ff5630",
  "#8777d9",
  "#57d9a3",
];

export function getModelColor(
  configName: string,
  configs: ModelConfigOut[]
): string {
  const index = configs.findIndex((c) => c.model_config_name === configName);
  return MODEL_COLORS[(index >= 0 ? index : 0) % MODEL_COLORS.length];
}
