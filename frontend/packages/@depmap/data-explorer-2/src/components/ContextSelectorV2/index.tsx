import React, { useState } from "react";
import { DataExplorerContextV2, DimensionType } from "@depmap/types";
import renderConditionally from "../../utils/render-conditionally";
import PlotConfigSelect from "../PlotConfigSelect";
import useGlobalEvents from "./useGlobalEvents";
import useContextHash from "./useContextHash";
import useOptions from "./useOptions";
import useChangeHandler, { handleCaseEdit } from "./useChangeHandler";
import useLabel from "./useLabel";
import usePlaceholder from "./usePlaceholder";
import styles from "../../styles/ContextSelector.scss";

interface Props {
  enable: boolean;
  value: DataExplorerContextV2 | null;
  dimension_type: string;
  onClickCreateContext: () => void;
  onClickSaveAsContext: () => void;
  onChange: (
    context: DataExplorerContextV2 | null,
    hash: string | null
  ) => void;
  label?: React.ReactNode | ((dimensionType: DimensionType | null) => string);
  swatchColor?: string;
  includeAllInOptions?: boolean;
  linkToContextManager?: boolean;
  hasError?: boolean;
  selectClassName?: string;
}

function ContextSelectorV2({
  enable,
  dimension_type,
  onClickCreateContext,
  onClickSaveAsContext,
  value,
  onChange,
  label = null,
  swatchColor = undefined,
  includeAllInOptions = false,
  linkToContextManager = false,
  hasError = false,
  selectClassName = undefined,
}: Props) {
  if (!dimension_type) {
    throw new Error("`dimension_type` is required!");
  }

  const [isLoadingContext, setIsLoadingContext] = useState(false);

  const {
    isLoadingHash,
    hashWithPrefix,
    hashOfSelectedValue,
    shouldShowSaveButton,
  } = useContextHash(value, dimension_type);
  const options = useOptions(
    value,
    dimension_type,
    includeAllInOptions,
    linkToContextManager
  );
  const handleChange = useChangeHandler(
    dimension_type,
    onChange,
    onClickCreateContext,
    value,
    hashOfSelectedValue,
    setIsLoadingContext
  );
  const resolvedLabel = useLabel(label, dimension_type);
  const placeholder = usePlaceholder(
    dimension_type,
    isLoadingContext || isLoadingHash
  );
  const { evalFailed, reactKey } = useGlobalEvents(
    value,
    hashOfSelectedValue,
    onChange
  );

  return (
    <div className={styles.contextSelector}>
      <PlotConfigSelect
        key={`${reactKey}`}
        show
        isClearable
        className={selectClassName}
        label={resolvedLabel}
        width={300}
        hasError={hasError || evalFailed}
        placeholder={placeholder}
        options={options}
        enable={enable && dimension_type !== "other"}
        value={hashWithPrefix}
        isLoading={isLoadingContext || isLoadingHash}
        swatchColor={swatchColor}
        onChange={(handleChange as unknown) as (value: string | null) => void}
        onChangeUsesWrappedValue
        classNamePrefix="context-selector"
        formatOptionLabel={(option: { label: string; value: string }) => {
          if (!option?.label) {
            return null;
          }

          if (option.value.startsWith("not_")) {
            return (
              <>
                <span className={styles.negatedContextBadge}>Not</span>
                {option.label.replace(/^Not /, "")}
              </>
            );
          }

          return option.label;
        }}
      />
      {Boolean(shouldShowSaveButton || evalFailed) && (
        <button
          className={styles.saveAsContextButton}
          type="button"
          onClick={() => {
            if (shouldShowSaveButton) {
              onClickSaveAsContext();
            } else {
              handleCaseEdit(value, hashOfSelectedValue);
            }
          }}
        >
          {evalFailed ? (
            <span> See issues ⚠️</span>
          ) : (
            <span>Save as Context +</span>
          )}
        </button>
      )}
    </div>
  );
}

export default renderConditionally(ContextSelectorV2);
