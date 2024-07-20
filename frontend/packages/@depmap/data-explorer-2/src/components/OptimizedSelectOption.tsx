import React from "react";
import cx from "classnames";
import { components } from "react-windowed-select";
import styles from "../styles/ContextSelector.scss";

// TODO: Convert the input into a "react-bootstrap-typeahead" as soon the user
// starts typing something.
function OptimizedSelectOption({ children, ...props }: any) {
  const { className, innerProps, isSelected, options } = props;
  let newProps = props;

  if (options.length > 10000) {
    newProps = {
      ...props,
      innerProps: {
        ...innerProps,
        onMouseMove: null,
        onMouseOver: null,
      },
      className: cx(className, {
        [styles.optimizedSelectOptionHover]: !isSelected,
      }),
    };
  }

  return (
    // eslint-disable-next-line react/jsx-props-no-spreading
    <components.Option {...newProps}>{children}</components.Option>
  );
}

export default OptimizedSelectOption;
