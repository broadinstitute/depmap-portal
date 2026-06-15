import { useCallback, useMemo, useState } from "react";
import {
  DataExplorerPlotResponse,
  EntityRef,
  EntityRefSet,
  pairRef,
  singleRef,
} from "@depmap/types";

// useSelection
//
// Owns plot selection state and the click/multiselect handlers. Encodes
// each selected point as an EntityRef — `"single"` for plain plots,
// `"pair"` for expanded plots — so that an expanded plot can distinguish
// between (model, transcript_A) and (model, transcript_B) instead of
// collapsing both to the model id.
//
// The pair-vs-single dispatch is based on `data.expansions`: when the
// response carries at least one expansion, point identity is the pair;
// otherwise it's the index id alone. Plot components consume this hook
// uniformly and don't need to branch on expansion presence themselves.
//
// Selection state is `EntityRefSet | null`, where the `null` state is
// meaningfully distinct from an empty set:
//   - `null` — no selection mode active (the panel can show
//     "set selection from a context"; the plot shows no selection
//     overlay).
//   - empty `EntityRefSet` — user is in a selection mode but has nothing
//     currently selected (e.g. just cleared an explicit selection).
//   - non-empty `EntityRefSet` — the obvious case.
// Callers that need to dismiss the selection state entirely call
// `clearSelection()`; callers that want an empty-but-active selection
// pass `new EntityRefSet()` to `setSelection`.
//
// Behavior:
//   - handleClickPoint(i, ctrl=false): replaces selection with just
//     point i. Matches existing behavior across all three plot types.
//   - handleClickPoint(i, ctrl=true): toggles point i in the existing
//     selection (or starts a new selection containing i if `null`).
//   - handleMultiselect(indices): replaces selection with the given
//     points. No-op when indices is empty (matches existing behavior).
//
// What this hook deliberately doesn't do:
//   - Label conversion. GeneTea and other consumers that want display
//     labels rather than ids should derive them at the call site from
//     `data` and `selection`. Selection identity is structural (ids);
//     labels are presentation.
//   - Panel rendering. The selection panel is its own component;
//     this hook only provides the data it consumes.
//   - Persistence. Selection is in-component state; if it ever needs
//     to round-trip through URL or storage, EntityRefSet.toJSON /
//     fromJSON are the right primitives but a different layer would
//     drive them.
export default function useSelection(
  data: DataExplorerPlotResponse | null
) {
  const [selection, setSelection] = useState<EntityRefSet | null>(null);

  const selectedPoints = useMemo(() => {
    const out = new Set<number>();
    if (!data?.index_ids || !selection) {
      return out;
    }

    for (let i = 0; i < data.index_ids.length; i += 1) {
      if (selection.has(refForPoint(data, i))) {
        out.add(i);
      }
    }
    return out;
  }, [data, selection]);

  const handleClickPoint = useCallback(
    (pointIndex: number, ctrlKey: boolean) => {
      if (!data) {
        return;
      }
      const ref = refForPoint(data, pointIndex);

      if (ctrlKey) {
        // Toggle within the existing selection. If selection is null
        // (the "no selection mode active" state), the toggle starts a
        // new selection containing just this point — matching the
        // pre-refactor behavior where ctrl-clicking from a null state
        // initialized a Set.
        setSelection((current) => {
          const base = current ?? new EntityRefSet();
          return base.has(ref) ? base.delete(ref) : base.add(ref);
        });
      } else {
        // Replace selection with just this one point.
        setSelection(new EntityRefSet([ref]));
      }
    },
    [data]
  );

  const handleMultiselect = useCallback(
    (pointIndices: number[]) => {
      if (!data || pointIndices.length === 0) {
        return;
      }
      const refs: EntityRef[] = pointIndices.map((i) => refForPoint(data, i));
      setSelection(new EntityRefSet(refs));
    },
    [data]
  );

  const clearSelection = useCallback(() => {
    setSelection(null);
  }, []);

  return {
    selection,
    selectedPoints,
    handleClickPoint,
    handleMultiselect,
    setSelection,
    clearSelection,
  };
}

// Build the EntityRef for the point at `pointIndex` in `data`. Single-ref
// for plain plots, pair-ref for expanded plots. The MVP "at most one
// expansion" constraint lets us index `expansions[0]` safely; if/when
// expand_by ever supports multiple expansions, EntityRef will need to
// grow a third variant (or carry an array of expansion ids) and this
// helper will follow.
//
// Structural cast on the expansion shape — keeps this module free of a
// dependency on the deeper expanded-plot type machinery in
// services/dataExplorerAPI. The same pattern is used elsewhere in the
// renderer where we want a narrow, optional read on the expansion data.
function refForPoint(
  data: DataExplorerPlotResponse,
  pointIndex: number
): EntityRef {
  const indexId = data.index_ids[pointIndex];
  const expansions = (data as { expansions?: { ids: string[] }[] }).expansions;
  if (expansions && expansions.length > 0) {
    return pairRef(indexId, expansions[0].ids[pointIndex]);
  }
  return singleRef(indexId);
}
