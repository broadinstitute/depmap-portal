import React, { useState } from "react";
import stableStringify from "json-stable-stringify";
import { Button, Modal } from "react-bootstrap";
import type { Settings } from "../../contexts/DataExplorerSettingsContext";
import { isValidNumber } from "./utils";
import PlotStyleFields from "./PlotStyleFields";
import styles from "../../styles/SettingsModal.scss";

interface Props {
  initialSettings: Settings;
  defaultSettings: Settings;
  onSave: (nextValue: Settings) => void;
  onHide: () => void;
}

function SettingsModal({
  initialSettings,
  defaultSettings,
  onSave,
  onHide,
}: Props) {
  const [settings, setSettings] = useState(initialSettings);

  const hasChanges =
    stableStringify(initialSettings) !== stableStringify(settings);

  const isValid =
    isValidNumber(settings.plotStyles.pointSize, 3, 50) &&
    isValidNumber(settings.plotStyles.facetedPointSize, 3, 50) &&
    isValidNumber(settings.plotStyles.pointOpacity, 0, 1) &&
    isValidNumber(settings.plotStyles.outlineWidth, 0, 10) &&
    settings.plotStyles.palette.qualitativeFew.length > 0 &&
    settings.plotStyles.palette.qualitativeMany.length > 0 &&
    (settings.plotStyles.pointOpacity > 0 ||
      settings.plotStyles.outlineWidth > 0);

  return (
    <Modal show backdrop="static" onHide={onHide}>
      <Modal.Header closeButton>
        <Modal.Title>Data Explorer 2.0 Settings</Modal.Title>
      </Modal.Header>
      <Modal.Body className={styles.SettingsModal}>
        <section>
          <h2>Plot Styles</h2>
          <PlotStyleFields
            plotStyles={settings.plotStyles}
            defaultPlotStyles={defaultSettings.plotStyles}
            onChange={(update) =>
              setSettings((prev) => ({
                ...prev,
                plotStyles: update(prev.plotStyles),
              }))
            }
          />
        </section>
      </Modal.Body>
      <Modal.Footer>
        <Button onClick={onHide}>Cancel</Button>
        <Button
          bsStyle="primary"
          disabled={!hasChanges || !isValid}
          onClick={() => onSave(settings)}
        >
          Save changes
        </Button>
      </Modal.Footer>
    </Modal>
  );
}

export default SettingsModal;
