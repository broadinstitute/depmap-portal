import React from "react";
import { createFilter, Props as ReactSelectProps } from "react-select";
import ReactWindowedSelect from "react-windowed-select";
import extendReactSelect from "../utils/extend-react-select";
import renderConditionally from "../utils/render-conditionally";

interface Props extends Omit<ReactSelectProps, "options"> {
  label: React.ReactNode;
  inlineLabel?: boolean;
  /*
   * react-select uses options formatted like:
   * [{ value: 'a', label: 'Label A' }, { value: 'b', label: 'Label B' }]
   *
   * To simplify things, this component also accepts options formatted like:
   * { a: 'Label A', b: 'Label B' }
   *
   * The simplified format is preferred†.
   *
   * † preferred only because the `value` and `onChange` props assume this
   * format and use bare strings to also "simplify things." While this is often
   * convenient, it can be confusing and limiting. See the
   * `onChangeUsesWrappedValue` prop described below.
   */
  options: Record<string, string> | object[];
  value: string | null;
  enable: boolean;
  onChange: (value: string | null) => void;
  // HACK: `onChange` usually unwraps the value from react-select for you. On
  // occassion, it may be desirable to have direct access to the wrapped value
  // (with the label and any custom properties that may exist on the option).
  //
  // Honestly, the fact this prop exists strongly suggests that the "simplified
  // format" this component uses was a bad idea.
  onChangeUsesWrappedValue?: boolean;
  // This is the width of the menu, not the component itself.
  width?: number | "max-content";
}

const ExtendedSelect = extendReactSelect(ReactWindowedSelect);
type Option = { value: string; label: string; options: Option[] };

// Turns react-select's nestable options into a flat lookup table.
// TODO: I should probably just embrace react-select's options format rather
// than doing this conversion.
const reactSelectOptionsToMap = (options: Option[]) => {
  let out: Record<string, string> = {};

  for (let i = 0; i < options.length; i += 1) {
    const opt = options[i];

    if (opt.value) {
      out[opt.value] = opt.label;
    }

    if (opt.options) {
      const nestedOpts = reactSelectOptionsToMap(opt.options);
      out = { ...out, ...nestedOpts };
    }
  }

  return out;
};

// See https://github.com/JedWatson/react-select/issues/3403#issuecomment-480183854
const workaroundFilter = createFilter({
  matchFrom: "any",
  stringify: (option) => `${option.label}`,
});

function PlotConfigSelect({
  label,
  options,
  enable,
  value,
  onChange,
  onChangeUsesWrappedValue = false,
  width = "max-content",
  ...otherProps
}: Props) {
  const flattenedOptions = Array.isArray(options)
    ? reactSelectOptionsToMap(options as Option[])
    : options;

  const toOption = (val: string | null) => {
    return val ? { value: val, label: flattenedOptions[val] } : null;
  };

  const formattedOptions = Array.isArray(options)
    ? options
    : Object.keys(options).map(toOption);

  const reactSelectValue = toOption(value);

  return (
    <ExtendedSelect
      {...otherProps}
      isDisabled={!enable}
      label={label}
      width={width}
      value={reactSelectValue}
      options={formattedOptions as ReactSelectProps["options"]}
      filterOption={otherProps.filterOption || workaroundFilter}
      onChange={(option) => {
        if (onChangeUsesWrappedValue) {
          onChange(((option as unknown) as string) || null);
        } else {
          onChange(option ? option.value : null);
        }
      }}
    />
  );
}

export default renderConditionally(PlotConfigSelect);
