import React from "react";
import { DataExplorerContextV2, DimensionType } from "@depmap/types";
import { isV2Context } from "../../utils/context";
import renderConditionally from "../../utils/render-conditionally";
import PlotConfigSelect from "../PlotConfigSelect";
import useGlobalEvents from "./useGlobalEvents";
import useContextHash from "./useContextHash";
import useOptions from "./useOptions";
import useChangeHandler from "./useChangeHandler";
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
  label?: React.ReactNode | ((dimensionType: DimensionType) => string);
  swatchColor?: string;
  includeAllInOptions?: boolean;
  hasError?: boolean;
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
}: Props) {
  if (value && !isV2Context(value)) {
    // TODO: Implementation conversion from legacy format.
    throw new Error("ContextSelectorV2 does not support legacy contexts");
  }

  const {
    isLoading,
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
    hashOfSelectedValue
  );
  const resolvedLabel = useLabel(label, context_type);
  const placeholder = usePlaceholder(context_type, isLoading);
  const { reactKey } = useGlobalEvents(value, hashOfSelectedValue, onChange);

  return (
    <div className={styles.contextSelector}>
      <PlotConfigSelect
        key={`${reactKey}`}
        show
        isClearable
        label={resolvedLabel}
        width={300}
        hasError={hasError}
        placeholder={placeholder}
        options={options}
        enable={enable && context_type !== "other"}
        value={hashWithPrefix}
        isLoading={isLoading}
        swatchColor={swatchColor}
        onChange={handleChange as any}
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
      {shouldShowSaveButton && (
        <button
          className={styles.saveAsContextButton}
          type="button"
          onClick={onClickSaveAsContext}
        >
          Save as Context +
        </button>
      )}
    </div>
  );
}

export default renderConditionally(ContextSelectorV2);
