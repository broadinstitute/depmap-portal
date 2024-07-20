import React from "react";

interface Props {
  name: string;
  label: string;
  value: string;
  onChange: (nextValue: string) => void;
}

function ColorSelector({ name, label, value, onChange }: Props) {
  return (
    <div>
      <label htmlFor={name}>{label}</label>
      <input
        type="color"
        name={name}
        value={value}
        onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
          return onChange(e.target.value);
        }}
      />
    </div>
  );
}

export default ColorSelector;
