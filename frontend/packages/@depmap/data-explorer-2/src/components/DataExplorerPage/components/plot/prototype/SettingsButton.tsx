import React from "react";
import { Tooltip } from "@depmap/common-components";
import { useLaunchSettingsModal } from "../../../../../contexts/DataExplorerSettingsContext";
import styles from "../../../styles/DataExplorer2.scss";

function SettingsButton() {
  const launchSettingsModal = useLaunchSettingsModal();

  return (
    <Tooltip
      id="settings-button-tooltip"
      content="Settings"
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
