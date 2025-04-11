import React from "react";
import PlotConfigSelect from "../PlotConfigSelect";
import { ContextBuilderReducerAction } from "./contextBuilderReducer";

interface Props {
  dispatch: React.Dispatch<ContextBuilderReducerAction>;
  expr: string | null;
  options: { label: string; value: string }[] | undefined;
  path: (string | number)[];
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
      hasError={shouldShowValidation && expr === null}
      value={expr ?? null}
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
