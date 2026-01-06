import React from "react";
import styles from "../../../styles/CustomAnalysesPage.scss";

interface Option<T extends string | boolean> {
  value: T;
  label: string;
  whenSelectedRender?: () => React.ReactNode;
}

interface Props<T extends string | boolean> {
  value: T;
  onChange: (nextValue: T) => void;
  options: Option<T>[];
}

function SingleSelectWithDynamicFields<T extends string | boolean>({
  value,
  onChange,
  options,
}: Props<T>) {
  const name = React.useRef(Math.random().toString(36).slice(2));

  return (
    <div className={styles.AnalysisSourceSelect}>
      {options.map((option) => (
        <React.Fragment key={String(option.value)}>
          <div className={styles.labeledRadio}>
            <label>
              <input
                type="radio"
                name={name.current}
                value={String(option.value)}
                checked={value === option.value}
                onChange={() => onChange(option.value)}
              />
              <span>{option.label}</span>
            </label>
          </div>
          {value === option.value && option.whenSelectedRender && (
            <div className={styles.inset}>{option.whenSelectedRender()}</div>
          )}
        </React.Fragment>
      ))}
    </div>
  );
}

export default SingleSelectWithDynamicFields;
