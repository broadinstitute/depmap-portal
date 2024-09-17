import React from "react";
import PlotConfigSelect from "../PlotConfigSelect";

interface Props {
  expr: any;
  path: any;
  dispatch: any;
  options: any;
  shouldShowValidation: boolean;
}

function Constant({
  expr,
  path,
  dispatch,
  options,
  shouldShowValidation,
}: Props) {
  return (
    <PlotConfigSelect
      show
      enable={Boolean(options)}
      hasError={shouldShowValidation && !expr}
      value={expr || null}
      onChange={(value) => {
        dispatch({
          type: "update-value",
          payload: { path, value },
        });
      }}
      options={options || []}
      placeholder="Select a value…"
      menuWidth={257}
      menuPortalTarget={document.querySelector("#modal-container")}
    />
  );
}

export default Constant;
