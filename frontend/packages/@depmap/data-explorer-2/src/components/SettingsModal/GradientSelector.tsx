/* eslint-disable jsx-a11y/no-static-element-interactions, jsx-a11y/click-events-have-key-events */
import React, { useState } from "react";
import GradientEditorPopover from "./GradientEditorPopover";
import styles from "../../styles/SettingsModal.scss";

interface Props {
  name: string;
  label: string;
  value: string[][];
  onChange: (nextValue: string, index: number) => void;
}

function GradientSelector({ name, label, value, onChange }: Props) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const [showEditor, setShowEditor] = useState(false);

  return (
    <div className={styles.gradient}>
      <label htmlFor={name}>{label}</label>
      <span ref={setAnchor} onClick={() => setShowEditor(true)}>
        {value.slice(0, -1).map((pair, i) => (
          <span
            key={pair[0]}
            style={{
              backgroundImage: `linear-gradient(to right, ${pair[1]}, ${
                value[i + 1][1]
              })`,
            }}
          />
        ))}
      </span>
      <GradientEditorPopover
        show={showEditor}
        anchor={anchor}
        onHide={() => setShowEditor(false)}
      >
        <div className={styles.gradientEditorItems}>
          {value.map((pair, index) => (
            <input
              key={pair[0]}
              type="color"
              value={pair[1]}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                return onChange(e.target.value, index);
              }}
            />
          ))}
        </div>
      </GradientEditorPopover>
    </div>
  );
}

export default GradientSelector;
