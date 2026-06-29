import { useEffect, useState } from "react";
import { cached, legacyPortalAPI } from "@depmap/api";
import getResistanceScreenTable from "../utilities/getResistanceScreenTable";

export async function getParentalModelId(
  modelId: string
): Promise<string | null> {
  const rows = await getResistanceScreenTable();
  const match = rows.find((r) => r.TestArmModelID === modelId);
  return match ? match.CtrlArmModelID : null;
}

export function altKey(a: {
  gene: { name: string };
  alteration: string;
}): string {
  return `${a.gene.name}\t${a.alteration}`;
}

export interface UseAcquiredAlterationsState {
  // Keys of alterations on this model that don't appear in the parent's list.
  // null while loading, or when the model has no parental line (i.e. is not
  // a resistant derivative).
  acquiredAlterations: Set<string> | null;
  loading: boolean;
  error: Error | null;
}

export function useAcquiredAlterations(
  modelId: string
): UseAcquiredAlterationsState {
  const [acquiredAlterations, setAcquired] = useState<Set<string> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setError(null);
    setAcquired(null);

    (async () => {
      try {
        const parentId = await getParentalModelId(modelId);
        if (!mounted) return;

        if (parentId === null) {
          // Not a derivative — no parent to compare against.
          setAcquired(null);
          setLoading(false);
          return;
        }

        const [own, parent] = await Promise.all([
          cached(legacyPortalAPI).getOncogenicAlterations(modelId),
          cached(legacyPortalAPI).getOncogenicAlterations(parentId),
        ]);
        if (!mounted) return;

        const parentKeys = new Set(parent.onco_alterations.map(altKey));
        setAcquired(
          new Set(
            own.onco_alterations
              .map(altKey)
              .filter((key) => !parentKeys.has(key))
          )
        );
        setLoading(false);
      } catch (err) {
        if (!mounted) return;
        setError(err as Error);
        setLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [modelId]);

  return { acquiredAlterations, loading, error };
}
