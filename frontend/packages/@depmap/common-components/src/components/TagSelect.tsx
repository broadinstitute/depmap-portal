import React from "react";

import CreatableSelect from "react-select/creatable";
import { ActionMeta, ValueType } from "react-select";

export interface TagOption {
  readonly label: string;
  readonly value: string;
  readonly isFixed?: boolean;
  isDisabled?: boolean;
}

interface TagSelectProps {
  readonly remainingOptions: readonly TagOption[];
  readonly selectedOptions: TagOption[] | null;
  /**
   * passes the remaining options and selected options to parent component to do something
   */
  forwardOptions?: (
    selectedOptions: TagOption[] | null,
    remainingOptions: TagOption[]
  ) => void;

  placeholder?: string;
  isDisabled?: boolean;
}

const TagSelect = ({
  remainingOptions,
  selectedOptions,
  forwardOptions = undefined,
  placeholder = undefined,
  isDisabled = undefined,
}: TagSelectProps) => {
  const onChange = (
    valueAfterAction: ValueType<TagOption, true>,
    actionMeta?: ActionMeta<TagOption>
  ) => {
    let newRemainingOptions: TagOption[];
    if (actionMeta?.action === "select-option") {
      newRemainingOptions = [
        ...remainingOptions.filter((option) => {
          return option !== (actionMeta.option as TagOption);
        }),
      ];
    } else if (actionMeta?.action === "remove-value") {
      newRemainingOptions = [
        ...remainingOptions,
        actionMeta.removedValue as TagOption,
      ];
    } else {
      newRemainingOptions =
        selectedOptions !== null
          ? [...remainingOptions, ...selectedOptions]
          : [...remainingOptions];
    }
    if (forwardOptions !== undefined) {
      forwardOptions(
        valueAfterAction as TagOption[] | null,
        newRemainingOptions
      );
    }
  };

  return (
    <>
      <CreatableSelect
        options={remainingOptions}
        value={selectedOptions}
        onChange={onChange}
        placeholder={placeholder}
        isMulti
        isClearable
        isDisabled={isDisabled}
      />
    </>
  );
};

export default TagSelect;
