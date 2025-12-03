import React, { useMemo } from "react";
import { Tooltip } from "@depmap/common-components";
import { pluralize } from "../../../../../../utils/misc";
import PlotConfigSelect from "../../../../../PlotConfigSelect";
import { useContextBuilderState } from "../../../../state/ContextBuilderState";
import useDimensionType from "../../../../hooks/useDimensionType";
import styles from "../../../../../../styles/ContextBuilderV2.scss";

interface Props {
  expr: string | null;
  path: (string | number)[];
  domain: { unique_values: string[] } | null;
  isLoading: boolean;
  onClickShowSlicePreview: () => void;
}

function StringConstant({
  expr,
  path,
  domain,
  isLoading,
  onClickShowSlicePreview,
}: Props) {
  const { dispatch, shouldShowValidation } = useContextBuilderState();
  const { dimensionType } = useDimensionType();

  const { options, isValidExpr } = useMemo(() => {
    if (!domain) {
      return { options: [], isValidExpr: true };
    }

    const opts: { label: string; value: string; isDisabled?: boolean }[] = [];
    let valid = false;

    for (let i = 0; i < domain.unique_values.length; i += 1) {
      const value = domain.unique_values[i];
      opts.push({ value, label: value });

      if (expr === value) {
        valid = true;
      }
    }

    if (expr && !valid) {
      opts.unshift({ label: expr, value: "", isDisabled: true });
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
      renderDetailsButton={
        domain && !isLoading
          ? () => (
              <button type="button" onClick={onClickShowSlicePreview}>
                see plot
              </button>
            )
          : undefined
      }
      value={expr}
      options={options}
      onChange={(value) => {
        dispatch({
          type: "update-value",
          payload: { path, value },
        });
      }}
      formatOptionLabel={(option: {
        label: string;
        value: string;
        isDisabled?: boolean;
      }) => {
        if (!option?.label) {
          return null;
        }

        if (option.isDisabled && dimensionType) {
          const entity = dimensionType.display_name.toLowerCase();
          const entities = pluralize(entity);

          return (
            <Tooltip
              className={styles.unblockable}
              id="unknown-value"
              content={`The value “${option.label}” does not match any ${entities}.`}
              placement="top"
            >
              <span style={{ cursor: "not-allowed" }}>{option.label}</span>
            </Tooltip>
          );
        }

        return option.label;
      }}
      placeholder="Select a value…"
      menuWidth={257}
      menuPortalTarget={document.querySelector("#modal-container")}
    />
  );
}

export default StringConstant;
