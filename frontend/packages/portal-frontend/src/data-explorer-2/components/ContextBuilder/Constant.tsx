import React from "react";
import cx from "classnames";
import Select from "react-windowed-select";
import { OptimizedSelectOption } from "@depmap/data-explorer-2";
import styles from "src/data-explorer-2/styles/ContextBuilder.scss";

const selectStyles = {
  control: (base: any) => ({
    ...base,
    fontSize: 13,
  }),
  menu: (base: any) => ({
    ...base,
    fontSize: 12,
    minWidth: "100%",
    width: 250,
  }),
};

function Constant({
  expr,
  path,
  dispatch,
  options,
  shouldShowValidation,
}: any) {
  return (
    <Select
      className={cx(styles.valueSelect, {
        [styles.invalidSelect]: shouldShowValidation && !expr,
      })}
      styles={selectStyles}
      value={expr ? { label: expr, value: expr } : null}
      onChange={(option: any) => {
        dispatch({
          type: "update-value",
          payload: {
            path,
            value: option.value,
          },
        });
      }}
      options={options}
      isDisabled={!options}
      placeholder="Select a value…"
      menuPortalTarget={document.querySelector("#modal-container")}
      components={{ Option: OptimizedSelectOption }}
    />
  );
}

export default Constant;
