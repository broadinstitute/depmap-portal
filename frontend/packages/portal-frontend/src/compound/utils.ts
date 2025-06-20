import { TableFormattedData } from "./types";

export const Rep1Color = "#CC4778";
export const Rep2Color = "#F89540";
export const Rep3Color = "#176CE0";

export const sortBySelectedModel = (
  doseTable: TableFormattedData,
  selectedModelIds: Set<string>
) => {
  return doseTable.sort((a, b) => {
    const aHasPriority = selectedModelIds.has(a.modelId);
    const bHasPriority = selectedModelIds.has(b.modelId);

    if (aHasPriority && !bHasPriority) {
      return -1; // a comes first
    }
    if (!aHasPriority && bHasPriority) {
      return 1; // b comes first
    }
    // If both or neither have a selectedModelId, it doesn't matter which comes first
    return -1;
  });
};
