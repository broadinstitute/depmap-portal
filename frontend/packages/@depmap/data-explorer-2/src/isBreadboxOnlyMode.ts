import qs from "qs";
import { showInfoModal } from "@depmap/common-components";
import { enabledFeatures, isElara } from "@depmap/globals";

function readSetting() {
  // By definition Elara only works with Breadbox.
  if (isElara) {
    return true;
  }

  // Never enable in environments that don't support experiments
  // (i.e. all of them other than Skyros).
  if (!enabledFeatures.data_explorer_2_experimental_settings) {
    return false;
  }

  const params = qs.parse(window.location.search.substr(1));

  // Look up the stored setting.
  const storageItem = window.localStorage.getItem("data_explorer_2_settings");
  const savedSettings = storageItem ? JSON.parse(storageItem) : {};
  const isSettingEnabled = savedSettings.useBreadboxBackend;

  // The presence of a query parameter overrides the stored setting.
  // That way we can create links that always recreate a given scenario.
  if (params.bb === "0") {
    if (isSettingEnabled) {
      showInfoModal({
        title: "Forcing legacy mode",
        content:
          "You have Breadbox mode enabled but this link was saved in 'Legacy Portal' mode.",
        closeButtonText: "OK",
      });
    }

    return false;
  }

  if (params.bb === "1") {
    if (!isSettingEnabled) {
      showInfoModal({
        title: "Forcing Breadbox mode",
        content:
          "You have Breadbox mode disabled but this link was saved with it enabled.",
        closeButtonText: "OK",
      });
    }

    return true;
  }

  return isSettingEnabled;
}

export const isBreadboxOnlyMode = readSetting();

window.addEventListener("popstate", () => {
  const shouldEnable = readSetting();

  if (isBreadboxOnlyMode !== shouldEnable) {
    window.location.reload();
  }
});
