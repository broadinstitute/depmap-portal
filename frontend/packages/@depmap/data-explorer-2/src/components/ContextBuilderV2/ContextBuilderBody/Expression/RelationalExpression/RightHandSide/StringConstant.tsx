import React from "react";
import PlotConfigSelect from "../../../../../PlotConfigSelect";
import { useContextBuilderState } from "../../../../state/ContextBuilderState";

interface Props {
  expr: string | null;
  path: (string | number)[];
  domain: { unique_values: string[] } | null;
  isLoading: boolean;
}

function StringConstant({ expr, path, domain, isLoading }: Props) {
  const { dispatch, shouldShowValidation } = useContextBuilderState();

  const hasError = shouldShowValidation && expr === null;
  const options =
    domain?.unique_values.map((value) => ({ value, label: value })) || [];

  return (
    <PlotConfigSelect
      show
      enable={!!domain && !isLoading}
      isLoading={isLoading}
      hasError={hasError}
      label="Value"
      value={expr}
      options={options}
      onChange={(value) => {
        dispatch({
          type: "update-value",
          payload: { path, value },
        });
      }}
      placeholder="Select a value…"
      menuWidth={257}
      menuPortalTarget={document.querySelector("#modal-container")}
    />
  );
}

export default StringConstant;
