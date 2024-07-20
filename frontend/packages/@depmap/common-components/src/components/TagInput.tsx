import React from "react";

import CreatableSelect from "react-select/creatable";
import { ActionMeta, ValueType } from "react-select";

const components = {
  DropdownIndicator: null as any,
};

export interface Option {
  readonly label: string;
  readonly value: string;
}

interface TagInputProps {
  readonly inputValue: string;
  readonly value: readonly Option[];
  onInputChange: (inputValue: string) => void;
  onChange: (
    value: ValueType<Option, true>,
    action: ActionMeta<Option>
  ) => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLElement>) => void;
  placeholder?: string;
  isDisabled?: boolean;
}

const TagInput = ({
  inputValue,
  onInputChange,
  onKeyDown,
  onChange,
  value,
  placeholder = undefined,
  isDisabled = undefined,
}: TagInputProps) => {
  return (
    <CreatableSelect
      components={components}
      inputValue={inputValue}
      onInputChange={onInputChange}
      onKeyDown={onKeyDown}
      onChange={onChange}
      value={value}
      placeholder={placeholder}
      menuIsOpen={false}
      isMulti
      isClearable
      isDisabled={isDisabled}
    />
  );
};

export default TagInput;
