import React, { useCallback, useRef } from "react";
import cx from "classnames";
import styles from "../styles/ToggleSwitch.scss";

interface Props<T> {
  value: T;
  onChange: (nextValue: T) => void;
  options: [{ label: string; value: T }, { label: string; value: T }];
  disabled?: boolean;
  className?: string;
}

function ToggleSwitch<T>({
  value,
  onChange,
  options,
  disabled = false,
  className = undefined,
}: Props<T>) {
  const ref = useRef<HTMLDivElement>(null);
  const [label0, label1] = [options[0].label, options[1].label];
  const selectedIndex = value === options[0].value ? 0 : 1;

  const handleChange = useCallback(
    (nextValue: T) => {
      onChange(nextValue);
      ref.current?.classList.add(styles.animating);

      setTimeout(() => {
        ref.current?.classList.remove(styles.animating);
      }, 200);
    },
    [onChange]
  );

  return (
    <div
      ref={ref}
      className={cx(className, styles.ToggleSwitch, {
        [styles.disabled]: disabled,
      })}
    >
      <label aria-hidden>{label0}</label>
      <button
        type="button"
        role="switch"
        disabled={disabled}
        aria-label={`toggles between ${label0} and ${label1}`}
        aria-checked={selectedIndex === 1}
        className={cx({ [styles.toggledOn]: selectedIndex === 1 })}
        onClick={() => {
          const index = selectedIndex === 1 ? 0 : 1;
          handleChange(options[index].value);
        }}
      />
      <label aria-hidden>{label1}</label>
    </div>
  );
}

export default ToggleSwitch;
