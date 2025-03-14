import { useCallback, useEffect, useState } from "react";
import { DataExplorerContextV2 } from "@depmap/types";
import { isNegatedContext, negateContext } from "../../utils/context";

export default function useGlobalEvents(
  value: DataExplorerContextV2 | null,
  hashOfSelectedValue: string | null,
  onChange: (context: DataExplorerContextV2 | null, hash: string | null) => void
) {
  const [reactKey, setReactKey] = useState(1);
  const forceRefresh = useCallback(() => setReactKey((k) => k + 1), []);

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
          onChange(
            negateContext(nextContext as DataExplorerContextV2),
            nextHash
          );
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

  return { reactKey };
}
