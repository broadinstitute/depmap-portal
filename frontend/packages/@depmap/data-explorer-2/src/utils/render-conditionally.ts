import React from "react";

// Adds a `show` prop to a component that will
// cause it to render `null` when that prop is falsy.
const renderConditionally = <P extends object>(
  Component: React.ComponentType<P>
): React.ComponentType<P & { show: boolean }> => {
  // eslint-disable-next-line react/prop-types
  return ({ show, ...otherProps }) => {
    if (!show) {
      return null;
    }

    return React.createElement(Component, otherProps as P);
  };
};

export default renderConditionally;
