import React from "react";

interface NumberInputProps {
  name: string;
  label: string;
  min?: number;
  max?: number;
  step?: number;
  value: number | undefined;
  setValue: (val: number) => void;
  width?: string | number;
  defaultValue?: number;
}

const NumberInput: React.FC<NumberInputProps> = ({
  name,
  label,
  min = 0,
  max,
  step = 1,
  value,
  setValue,
  width = "50%",
  defaultValue = min,
}) => (
  <div
    style={{
      display: "flex",
      flexDirection: "column",
      alignItems: "flex-start",
      gap: 4,
    }}
  >
    <label
      htmlFor={name}
      style={{ fontWeight: 400, marginBottom: 0, paddingLeft: 0 }}
    >
      {label}
    </label>
    <input
      id={name}
      type="number"
      name={name}
      min={min}
      max={max}
      step={step}
      value={value}
      style={{ width, textAlign: "left", paddingLeft: 4 }}
      onChange={(e) => {
        let val = e.target.value;
        if (val === "" || val === null) return;
        let numVal = Number(val);
        // If step is integer, floor; otherwise, allow decimals
        const isIntStep = Number.isInteger(step);
        let finalVal = isIntStep ? Math.floor(numVal) : numVal;
        if (min !== undefined) finalVal = Math.max(min, finalVal);
        if (max !== undefined) finalVal = Math.min(max, finalVal);
        setValue(finalVal);
      }}
      onBlur={(e) => {
        if (e.target.value === "" || e.target.value === null) {
          setValue(defaultValue);
        }
      }}
    />
  </div>
);

export default NumberInput;
