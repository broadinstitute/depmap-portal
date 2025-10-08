import React, { useMemo } from "react";
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

  const { options, isValidExpr } = useMemo(() => {
    if (!domain) {
      return { options: [], isValidExpr: true };
    }

    const opts: { label: string; value: string }[] = [];
    let valid = false;

    for (let i = 0; i < domain.unique_values.length; i += 1) {
      const value = domain.unique_values[i];
      opts.push({ value, label: value });

      if (expr === value) {
        valid = true;
      }
    }

    if (expr && !valid) {
      opts.unshift({ label: expr, value: expr });
    }

    return { options: opts, isValidExpr: valid };
  }, [expr, domain]);

  const hasError =
    (shouldShowValidation && expr === null) || (expr !== null && !isValidExpr);

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
