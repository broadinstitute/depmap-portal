/* eslint-disable jsx-a11y/no-static-element-interactions, jsx-a11y/click-events-have-key-events */
import React, { useState } from "react";
import GradientEditorPopover from "./GradientEditorPopover";
import styles from "../../styles/SettingsModal.scss";

interface Props {
  name: string;
  label: string;
  value: string[];
  onChange: (color: string, index: number) => void;
  onChangeNumColors: (n: number) => void;
}

function CategoricalPaletteSelector({
  name,
  label,
  value,
  onChange,
  onChangeNumColors,
}: Props) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const [showEditor, setShowEditor] = useState(false);

  return (
    <div className={styles.gradient}>
      <label htmlFor={name}>{label}</label>
      <span
        ref={setAnchor}
        style={{ width: value.length * 6 + 2 }}
        onClick={() => setShowEditor(true)}
      >
        {value.map((color, i) => (
          // eslint-disable-next-line react/no-array-index-key
          <span key={i} style={{ backgroundColor: color }} />
        ))}
      </span>
      <GradientEditorPopover
        show={showEditor}
        anchor={anchor}
        onHide={() => setShowEditor(false)}
      >
        <div
          className={styles.gradientEditorItems}
          style={{ minHeight: 27 * 2 }}
        >
          {value.map((color, index) => (
            <input
              // eslint-disable-next-line react/no-array-index-key
              key={index}
              type="color"
              value={color}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                return onChange(e.target.value, index);
              }}
            />
          ))}
        </div>
        <div>
          <label htmlFor="num-colors">number of levels</label>
          <input
            type="number"
            min={0}
            value={value.length}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
              const numColors = e.target.valueAsNumber;

              if (!Number.isNaN(numColors)) {
                onChangeNumColors(numColors);
              }
            }}
          />
        </div>
      </GradientEditorPopover>
    </div>
  );
}

export default CategoricalPaletteSelector;
