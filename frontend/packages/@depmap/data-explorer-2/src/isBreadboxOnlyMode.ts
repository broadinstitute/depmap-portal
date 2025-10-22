import qs from "qs";
import { isElara } from "@depmap/globals";

function readSetting() {
  // By definition Elara only works with Breadbox.
  if (isElara) {
    return true;
  }

  const params = qs.parse(window.location.search.substr(1));

  // The presence of a query parameter overrides the stored setting.
  if (params.bb === "0") {
    return false;
  }

  if (params.bb === "1") {
    return true;
  }

  // Look up the stored setting.
  const storageItem = window.localStorage.getItem("data_explorer_2_settings");
  const savedSettings = storageItem ? JSON.parse(storageItem) : {};
  const useLegacyMode = savedSettings.useLegacyPortalBackend;

  return !useLegacyMode;
}

export const isBreadboxOnlyMode = readSetting();

window.addEventListener("popstate", () => {
  const shouldEnable = readSetting();

  if (isBreadboxOnlyMode !== shouldEnable) {
    window.location.reload();
  }
});
