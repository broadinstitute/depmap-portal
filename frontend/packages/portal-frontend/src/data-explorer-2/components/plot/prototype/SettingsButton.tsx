import React from "react";
import { Tooltip } from "@depmap/common-components";
import { useLaunchSettingsModal } from "@depmap/data-explorer-2";
import styles from "src/data-explorer-2/styles/DataExplorer2.scss";

function SettingsButton() {
  const launchSettingsModal = useLaunchSettingsModal();

  return (
    <Tooltip
      id="settings-button-tooltip"
      content="Configure styles"
      placement="top"
      className={styles.settingsButtonTooltip}
    >
      <button
        type="button"
        className={styles.SettingsButton}
        onClick={launchSettingsModal}
      >
        <span className="glyphicon glyphicon-cog" aria-label="settings" />
      </button>
    </Tooltip>
  );
}

export default SettingsButton;
