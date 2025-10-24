import React, { useState } from "react";
import stableStringify from "json-stable-stringify";
import { Button, Modal } from "react-bootstrap";
import type { Settings } from "../../contexts/DataExplorerSettingsContext";
import { isValidNumber, updateColor, updateStyle } from "./utils";
import ColorSelector from "./ColorSelector";
import CategoricalPaletteSelector from "./CategoricalPaletteSelector";
import GradientSelector from "./GradientSelector";
import styles from "../../styles/SettingsModal.scss";

interface Props {
  initialSettings: Settings;
  defaultSettings: Settings;
  onSave: (nextValue: Settings) => void;
  onHide: () => void;
  feedbackUrl?: string;
}

function SettingsModal({
  initialSettings,
  defaultSettings,
  onSave,
  onHide,
  feedbackUrl = "",
}: Props) {
  const [settings, setSettings] = useState(initialSettings);

  const hasChanges =
    stableStringify(initialSettings) !== stableStringify(settings);

  const isValid =
    isValidNumber(settings.plotStyles.pointSize, 3, 50) &&
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
        <section className={styles.stylesSection}>
          <h2>Plot Styles</h2>
          <div style={{ marginTop: -10 }}>
            <label htmlFor="point-size">point size</label>
            <input
              type="number"
              name="point-size"
              min={3}
              max={50}
              value={settings.plotStyles.pointSize ?? ""}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                const pointSize = e.target.valueAsNumber;
                setSettings(updateStyle("pointSize", pointSize));
              }}
            />
            <span>px</span>
          </div>
          <div>
            <label htmlFor="point-opacity">point opacity</label>
            <input
              type="number"
              name="point-opacity"
              min={0}
              max={1}
              step={0.1}
              value={settings.plotStyles.pointOpacity ?? ""}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                const pointOpacity = e.target.valueAsNumber;
                setSettings(updateStyle("pointOpacity", pointOpacity));
              }}
            />
          </div>
          <div>
            <label htmlFor="outline-width">outline width</label>
            <input
              type="number"
              name="outline-width"
              min={0}
              max={10}
              step={0.5}
              value={settings.plotStyles.outlineWidth ?? ""}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                const outlineWidth = e.target.valueAsNumber;
                setSettings(updateStyle("outlineWidth", outlineWidth));
              }}
            />
            <span>px</span>
          </div>
          <div>
            <label htmlFor="x-axis-font-size">X axis font size</label>
            <input
              type="number"
              name="x-axis-font-size"
              min={10}
              max={50}
              step={1}
              value={settings.plotStyles.xAxisFontSize ?? ""}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                const xAxisFontSize = e.target.valueAsNumber;
                setSettings(updateStyle("xAxisFontSize", xAxisFontSize));
              }}
            />
            <span>px</span>
          </div>
          <div>
            <label htmlFor="y-axis-font-size">Y axis font size</label>
            <input
              type="number"
              name="y-axis-font-size"
              min={10}
              max={50}
              step={1}
              value={settings.plotStyles.yAxisFontSize ?? ""}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                const yAxisFontSize = e.target.valueAsNumber;
                setSettings(updateStyle("yAxisFontSize", yAxisFontSize));
              }}
            />
            <span>px</span>
          </div>
          <ColorSelector
            name="all-point-color"
            label="default point color"
            value={settings.plotStyles.palette.all}
            onChange={(value) => setSettings(updateColor("all", value))}
          />
          <ColorSelector
            name="other-point-color"
            label="other / NA color"
            value={settings.plotStyles.palette.other}
            onChange={(value) => setSettings(updateColor("other", value))}
          />
          <ColorSelector
            name="compare1"
            label="context 1"
            value={settings.plotStyles.palette.compare1}
            onChange={(value) => setSettings(updateColor("compare1", value))}
          />
          <ColorSelector
            name="compare2"
            label="context 2"
            value={settings.plotStyles.palette.compare2}
            onChange={(value) => setSettings(updateColor("compare2", value))}
          />
          <ColorSelector
            name="compareBoth"
            label="context overlap"
            value={settings.plotStyles.palette.compareBoth}
            onChange={(value) => setSettings(updateColor("compareBoth", value))}
          />
          <GradientSelector
            name="sequential-scale"
            label="sequential scale"
            value={settings.plotStyles.palette.sequentialScale}
            onChange={(value, index) => {
              setSettings((prev) =>
                updateColor(
                  "sequentialScale",
                  prev.plotStyles.palette.sequentialScale.map((pair, i) =>
                    i === index ? [pair[0], value] : pair
                  )
                )(prev)
              );
            }}
          />
          <CategoricalPaletteSelector
            name="qualitative-few"
            label="qualitative (few)"
            value={settings.plotStyles.palette.qualitativeFew}
            onChangeNumColors={(n) => {
              setSettings((prev) =>
                updateColor(
                  "qualitativeFew",
                  (() => {
                    let nextValue = prev.plotStyles.palette.qualitativeFew;

                    if (n < nextValue.length) {
                      nextValue = nextValue.slice(0, n);
                    } else {
                      nextValue = [
                        ...nextValue,
                        ...defaultSettings.plotStyles.palette.qualitativeFew.filter(
                          (_, i) => i >= nextValue.length && i < n
                        ),
                      ];

                      if (nextValue.length < n && n <= 30) {
                        for (let i = nextValue.length; i < n; i += 1) {
                          nextValue.push("#ffffff");
                        }
                      }
                    }

                    return nextValue;
                  })()
                )(prev)
              );
            }}
            onChange={(color, index) => {
              setSettings((prev) => {
                return updateColor(
                  "qualitativeFew",
                  prev.plotStyles.palette.qualitativeFew.map((prevColor, i) =>
                    i === index ? color : prevColor
                  )
                )(prev);
              });
            }}
          />
          <CategoricalPaletteSelector
            name="qualitative-many"
            label="qualitative (many)"
            value={settings.plotStyles.palette.qualitativeMany}
            onChangeNumColors={(n) => {
              setSettings((prev) =>
                updateColor(
                  "qualitativeMany",
                  (() => {
                    let nextValue = prev.plotStyles.palette.qualitativeMany;

                    if (n < nextValue.length) {
                      nextValue = nextValue.slice(0, n);
                    } else {
                      nextValue = [
                        ...nextValue,
                        ...defaultSettings.plotStyles.palette.qualitativeMany.filter(
                          (_, i) => i >= nextValue.length && i < n
                        ),
                      ];

                      if (nextValue.length < n && n <= 30) {
                        for (let i = nextValue.length; i < n; i += 1) {
                          nextValue.push("#ffffff");
                        }
                      }
                    }

                    return nextValue;
                  })()
                )(prev)
              );
            }}
            onChange={(color, index) => {
              setSettings((prev) => {
                return updateColor(
                  "qualitativeMany",
                  prev.plotStyles.palette.qualitativeMany.map((prevColor, i) =>
                    i === index ? color : prevColor
                  )
                )(prev);
              });
            }}
          />
          <div className={styles.buttons}>
            <Button
              onClick={() =>
                setSettings((prev) => ({
                  ...prev,
                  plotStyles: defaultSettings.plotStyles,
                }))
              }
            >
              Restore default styles
            </Button>
          </div>
        </section>
        <section>
          <h2>
            Experimental <i className="fa fa-flask" />
          </h2>
          <div>
            <label className={styles.checkboxLabel}>
              <input
                id="use-legacy-portal-backend"
                type="checkbox"
                checked={settings.useLegacyPortalBackend}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                  const { checked } = e.target;
                  setSettings((prev) => ({
                    ...prev,
                    useLegacyPortalBackend: checked,
                  }));
                }}
              />
              <span>Use Legacy Mode</span>
            </label>
            <p>
              <i>
                Try this if any data fails to load. It will fall back to using
                our legacy database.
              </i>
              {feedbackUrl && (
                <i>
                  <br />
                  Then{" "}
                  <a
                    href={feedbackUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    let us know
                  </a>{" "}
                  so we can resolve the issue!
                </i>
              )}
            </p>
          </div>
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
