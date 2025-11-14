import { useEffect, useState } from "react";
import { DataExplorerContextV2 } from "@depmap/types";
import {
  isContextAll,
  isNegatedContext,
  loadContextsFromLocalStorage,
  negateContext,
} from "../../utils/context";
import getContextHash from "../../utils/get-context-hash";

const toContextSelectorHash = async (context: DataExplorerContextV2 | null) => {
  if (!context) {
    return null;
  }

  if (isContextAll(context)) {
    return "all";
  }

  return getContextHash(
    isNegatedContext(context) ? negateContext(context) : context
  );
};

export default function useContextHash(
  value: DataExplorerContextV2 | null,
  dimension_type: string
) {
  const [hashOfSelectedValue, setHashOfSelectedValue] = useState<string | null>(
    null
  );

  useEffect(() => {
    (async () => {
      setHashOfSelectedValue(null);
      const hash = await toContextSelectorHash(value);
      setHashOfSelectedValue(hash);
    })();
  }, [value]);

  const isLoadingHash = Boolean(value) && !hashOfSelectedValue;

  const hashWithPrefix = isNegatedContext(value)
    ? `not_${hashOfSelectedValue}`
    : hashOfSelectedValue;

  const loadedContexts = loadContextsFromLocalStorage(dimension_type);

  const isKnownContext =
    hashOfSelectedValue === "all" ||
    (loadedContexts != null &&
      hashOfSelectedValue != null &&
      hashOfSelectedValue in loadedContexts);

  const shouldShowSaveButton =
    !!value &&
    !!hashOfSelectedValue &&
    !isKnownContext &&
    !isContextAll(value) &&
    dimension_type !== "other";

  return {
    hashOfSelectedValue,
    hashWithPrefix,
    isKnownContext,
    isLoadingHash,
    shouldShowSaveButton,
  };
}
