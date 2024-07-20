/* eslint-disable jsx-a11y/no-static-element-interactions, jsx-a11y/click-events-have-key-events */
import React, { useEffect, useRef, useState } from "react";
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
  const div = useRef<HTMLDivElement>(null);
  const [showEditor, setShowEditor] = useState(false);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (div.current && !div.current.contains(event.target as HTMLElement)) {
        setShowEditor(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [div]);

  return (
    <div className={styles.gradient}>
      <label htmlFor={name}>{label}</label>
      <span
        style={{ width: value.length * 6 + 2 }}
        onClick={() => setShowEditor(true)}
      >
        {value.map((color, i) => (
          // eslint-disable-next-line react/no-array-index-key
          <span key={i} style={{ backgroundColor: color }} />
        ))}
      </span>
      {showEditor && (
        <div ref={div} className={styles.gradientEditor}>
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
        </div>
      )}
    </div>
  );
}

export default CategoricalPaletteSelector;
