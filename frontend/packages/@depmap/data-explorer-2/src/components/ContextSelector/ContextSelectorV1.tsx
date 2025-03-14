import React, { useCallback, useEffect, useState } from "react";
import { DataExplorerContext } from "@depmap/types";
import { useDeprecatedDataExplorerApi } from "../../contexts/DeprecatedDataExplorerApiContext";
import renderConditionally from "../../utils/render-conditionally";
import {
  isContextAll,
  isNegatedContext,
  loadContextsFromLocalStorage,
  negateContext,
} from "../../utils/context";
import PlotConfigSelect from "../PlotConfigSelect";
import {
  getPlaceholder,
  isKnownContext,
  makeChangeHandler,
  toContextSelectorHash,
} from "./context-selector-utils";
import useOptions from "./useOptions";
import styles from "../../styles/ContextSelector.scss";

interface Props {
  enable: boolean;
  value: DataExplorerContext | null;
  context_type: string;
  onClickCreateContext: () => void;
  onClickSaveAsContext: () => void;
  onChange: (context: DataExplorerContext | null, hash: string | null) => void;
  label?: React.ReactNode;
  swatchColor?: string;
  includeAllInOptions?: boolean;
  hasError?: boolean;
}

function ContextSelectorV1({
  enable,
  value,
  context_type,
  onClickCreateContext,
  onClickSaveAsContext,
  onChange,
  label = undefined,
  swatchColor = undefined,
  includeAllInOptions = false,
  hasError = false,
}: Props) {
  const api = useDeprecatedDataExplorerApi();
  const loadedContexts = loadContextsFromLocalStorage(context_type);
  const [hashOfSelectedValue, setHashOfSelectedValue] = useState<string | null>(
    null
  );
  const [reactKey, setReactKey] = useState(1);
  const forceRefresh = useCallback(() => setReactKey((k) => k + 1), []);

  useEffect(() => {
    (async () => {
      setHashOfSelectedValue(null);
      const hash = await toContextSelectorHash(value);
      setHashOfSelectedValue(hash);
    })();
  }, [value]);

  useEffect(() => {
    window.addEventListener("dx2_contexts_updated", forceRefresh);
    window.addEventListener("celllinelistsupdated", forceRefresh);

    return () => {
      window.removeEventListener("dx2_contexts_updated", forceRefresh);
      window.removeEventListener("celllinelistsupdated", forceRefresh);
    };
  });

  useEffect(() => {
    const onContextEdited = async (e: Event) => {
      const { prevHash, nextContext, nextHash } = (e as CustomEvent).detail;

      if (hashOfSelectedValue && hashOfSelectedValue === prevHash) {
        if (isNegatedContext(value)) {
          onChange(negateContext(nextContext), nextHash);
        } else {
          onChange(nextContext, nextHash);
        }
      }
    };

    window.addEventListener("dx2_context_edited", onContextEdited);

    return () => {
      window.removeEventListener("dx2_context_edited", onContextEdited);
    };
  }, [value, hashOfSelectedValue, onChange]);

  const shouldShowSaveButton =
    !!value &&
    !!hashOfSelectedValue &&
    !isKnownContext(hashOfSelectedValue, loadedContexts) &&
    !isContextAll(value) &&
    context_type !== "other";

  const options = useOptions(
    value,
    hashOfSelectedValue,
    loadedContexts,
    shouldShowSaveButton,
    includeAllInOptions
  );

  const hashWithPrefix = isNegatedContext(value)
    ? `not_${hashOfSelectedValue}`
    : hashOfSelectedValue;

  const handleChange = makeChangeHandler(
    api,
    value,
    context_type,
    forceRefresh,
    hashOfSelectedValue,
    onChange,
    onClickCreateContext
  );

  const isLoading = Boolean(value) && !hashOfSelectedValue;

  return (
    <div className={styles.contextSelector}>
      <PlotConfigSelect
        key={`${reactKey}`}
        show
        isClearable
        label={label}
        width={300}
        hasError={hasError}
        placeholder={isLoading ? "" : getPlaceholder(context_type)}
        options={options}
        enable={enable && context_type !== "other"}
        value={hashWithPrefix}
        isLoading={isLoading}
        swatchColor={swatchColor}
        onChange={handleChange}
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

export default renderConditionally(ContextSelectorV1);
