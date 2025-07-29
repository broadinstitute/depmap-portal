import { enabledFeatures, isElara } from "@depmap/globals";

const storageItem = window.localStorage.getItem("data_explorer_2_settings");
const savedSettings = storageItem ? JSON.parse(storageItem) : {};

export const isBreadboxOnlyMode =
  isElara ||
  Boolean(
    enabledFeatures.data_explorer_2_experimental_settings &&
      savedSettings.useBreadboxBackend
  );
