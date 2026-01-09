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
  context_type: string;
  onClickCreateContext: () => void;
  onClickSaveAsContext: () => void;
  onChange: (
    context: DataExplorerContextV2 | null,
    hash: string | null
  ) => void;
  label?: React.ReactNode | ((dimensionType: DimensionType | null) => string);
  swatchColor?: string;
  includeAllInOptions?: boolean;
  hasError?: boolean;
  selectClassName?: string;
}

function ContextSelectorV2({
  enable,
  context_type,
  onClickCreateContext,
  onClickSaveAsContext,
  value,
  onChange,
  label = null,
  swatchColor = undefined,
  includeAllInOptions = false,
  hasError = false,
  selectClassName = undefined,
}: Props) {
  if (!context_type) {
    throw new Error("`context_type` is required!");
  }

  const [isLoadingContext, setIsLoadingContext] = useState(false);

  const {
    isLoadingHash,
    hashWithPrefix,
    hashOfSelectedValue,
    shouldShowSaveButton,
  } = useContextHash(value, context_type);
  const options = useOptions(value, context_type, includeAllInOptions);
  const handleChange = useChangeHandler(
    context_type,
    onChange,
    onClickCreateContext,
    value,
    hashOfSelectedValue,
    setIsLoadingContext
  );
  const resolvedLabel = useLabel(label, context_type);
  const placeholder = usePlaceholder(
    context_type,
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
        enable={enable && context_type !== "other"}
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
