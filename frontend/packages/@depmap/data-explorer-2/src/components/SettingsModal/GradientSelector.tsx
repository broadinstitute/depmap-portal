/* eslint-disable jsx-a11y/no-static-element-interactions, jsx-a11y/click-events-have-key-events */
import React, { useEffect, useRef, useState } from "react";
import styles from "../../styles/SettingsModal.scss";

interface Props {
  name: string;
  label: string;
  value: string[][];
  onChange: (nextValue: string, index: number) => void;
}

function GradientSelector({ name, label, value, onChange }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [showEditor, setShowEditor] = useState(false);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as HTMLElement)) {
        setShowEditor(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [ref]);

  return (
    <div className={styles.gradient}>
      <label htmlFor={name}>{label}</label>
      <span onClick={() => setShowEditor(true)}>
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
      {showEditor && (
        <div ref={ref} className={styles.gradientEditor}>
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
        </div>
      )}
    </div>
  );
}

export default GradientSelector;
