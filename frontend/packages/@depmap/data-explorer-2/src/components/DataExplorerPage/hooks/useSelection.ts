import { useCallback, useMemo, useRef, useState } from "react";
import {
  ColorByValue,
  DataExplorerPlotResponse,
  EntityRef,
  EntityRefSet,
  entityRefKey,
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
// Grain switch (expansion-selection design). The pair-vs-single decision is
// NOT simply "is the response expanded." It is conditional on `groupBy`:
//
//   - group_by === "expansion" (the pre-installed default for expansion mode):
//     selection collapses to the MODEL id (single ref). Regions are expansion
//     members (transcripts); a model appears exactly once per region, so a
//     within-region gesture resolves unambiguously to a model. (Confining the
//     gesture to one region is enforced structurally by the renderers — see
//     `enforceSingleGroupSelection` — not here.)
//   - expanded, but group_by is anything else (null = regionless interspersed,
//     or a real annotation): a model recurs many times per region, so identity
//     needs the full (index, expansion) PAIR.
//   - not expanded: single ref, as before.
//
// The EntityRef `pair` variant is therefore CONDITIONALLY LIVE by design —
// reachable whenever `pairGrained` is true — not dead code. A future cleanup
// pass must not remove it. (An earlier facet-axis design would have let the
// pair be deleted; that design was reversed in favor of keeping group_by
// flexibility, and the pair is the accepted cost.)
//
// Two channels: selection vs. annotation. There is a SECOND set alongside
// `selection`: `annotationRefs`, the points to put text labels on. They
// coincide for every non-collapse config, but diverge under
// group_by === "expansion":
//   - `selection` (grain-switched) is what's selected — drives the panel,
//     point highlighting, and the selection count. Under collapse it holds
//     MODELS, so `selectedPoints` re-expands to every (model, region) point a
//     selected model appears in (M selected models -> M*regions points).
//   - `annotationRefs` (always FINE grain — pairRef when expanded, singleRef
//     otherwise) is precisely the points the user contacted with the selecting
//     gesture. It does NOT re-expand, so labels stay on the handful of points
//     the box actually touched instead of cluttering every region.
// Invariant: annotated ⊆ selected. Every annotation ref's selection-grain
// projection (singleRef(indexId) under collapse, identity otherwise) is a
// member of `selection`; the ctrl-toggle and context paths below preserve this.
// Because fine grain == selection grain whenever group_by !== "expansion", the
// two sets are identical there and `pointsToAnnotate === selectedPoints` —
// i.e. plain plots and null/annotation-grouped expanded plots are unchanged.
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
//   - The within-group selection restriction. Under group_by === "expansion"
//     a gesture must stay within one region; that is enforced at the renderer
//     (physically impossible to draw across groups) rather than by filtering
//     indices here, so this hook only collapses to models and trusts the
//     indices it is handed.
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
  data: DataExplorerPlotResponse | null,
  groupBy?: ColorByValue | null
) {
  const [selection, setSelection] = useState<EntityRefSet | null>(null);
  // The contacted/representative points to annotate (fine grain). See header.
  const [annotationRefs, setAnnotationRefs] = useState<EntityRefSet | null>(
    null
  );

  // Latest committed selection, readable inside handlers without subscribing
  // the callbacks to `selection` (keeps onClickPoint identity stable so the
  // renderers don't re-init on every selection change). Clicks are discrete, so
  // this is current at gesture time.
  const selectionRef = useRef<EntityRefSet | null>(selection);
  selectionRef.current = selection;

  const isExpanded =
    ((data as { expansions?: { ids: string[] }[] } | null)?.expansions
      ?.length ?? 0) > 0;

  // The one boolean the grain hinges on (see header). Pair only when expanded
  // AND not in the model-clean "expansion" grouping.
  const pairGrained = isExpanded && groupBy !== "expansion";

  // Build the EntityRef for the point at `pointIndex`. Pair ref when
  // `pairGrained`, single ref otherwise. The MVP "at most one expansion"
  // constraint lets us index `expansions[0]` safely; if/when expand_by ever
  // supports multiple expansions, EntityRef will need to grow a third variant
  // (or carry an array of expansion ids) and this will follow.
  const refForPoint = useCallback(
    (pointIndex: number): EntityRef => {
      const d = data as DataExplorerPlotResponse;
      const indexId = d.index_ids[pointIndex];
      if (pairGrained) {
        const expansions = (d as { expansions?: { ids: string[] }[] })
          .expansions!;
        return pairRef(indexId, expansions[0].ids[pointIndex]);
      }
      return singleRef(indexId);
    },
    [data, pairGrained]
  );

  // The point's FINE-grain ref: pair whenever the plot is expanded (regardless
  // of group_by), single otherwise. This is the annotation grain — it never
  // collapses, so it identifies the exact contacted point even when `selection`
  // is collapsed to the model. Equals `refForPoint` whenever not collapsing.
  const fineRefForPoint = useCallback(
    (pointIndex: number): EntityRef => {
      const d = data as DataExplorerPlotResponse;
      const indexId = d.index_ids[pointIndex];
      if (isExpanded) {
        const expansions = (d as { expansions?: { ids: string[] }[] })
          .expansions!;
        return pairRef(indexId, expansions[0].ids[pointIndex]);
      }
      return singleRef(indexId);
    },
    [data, isExpanded]
  );

  // Project a fine ref down to the selection grain so annotation refs can be
  // matched against selection: under collapse a pair's "owner" is its model
  // (singleRef of its indexId); otherwise the ref is already selection-grained.
  const projectToSelectionGrain = useCallback(
    (ref: EntityRef): EntityRef =>
      groupBy === "expansion" ? singleRef(ref.indexId) : ref,
    [groupBy]
  );

  const selectedPoints = useMemo(() => {
    const out = new Set<number>();
    if (!data?.index_ids || !selection) {
      return out;
    }

    for (let i = 0; i < data.index_ids.length; i += 1) {
      if (selection.has(refForPoint(i))) {
        out.add(i);
      }
    }
    return out;
  }, [data, selection, refForPoint]);

  // The resolved points to annotate. A point is labeled only if it was
  // contacted (its fine ref is in `annotationRefs`) AND its owner is still
  // selected (its selection-grain ref is in `selection`). That second clause is
  // what enforces annotated ⊆ selected STRUCTURALLY, at render time, rather than
  // only through the handlers: annotations can't outlive the selection no matter
  // how it was cleared. The motivating case is an implicit clear that bypasses
  // every handler — e.g. switching group_by to "expansion" flips the selection
  // grain, so the wrappers' cleanup effect prunes the now-mismatched refs out of
  // `selection`, while the still-pair-grained annotation refs keep resolving
  // against the same expansion. Without the `selection.has` clause those labels
  // would hang around with nothing selected. (Walks the response so rows come
  // out in point order; a ref whose point no longer exists simply doesn't
  // resolve, which is why annotationRefs still needs no cleanup pass of its own —
  // it is replaced wholesale on the next gesture and bounded by this clause in
  // the meantime.)
  const pointsToAnnotate = useMemo(() => {
    const out = new Set<number>();
    if (!data?.index_ids || !annotationRefs || !selection) {
      return out;
    }
    for (let i = 0; i < data.index_ids.length; i += 1) {
      if (
        annotationRefs.has(fineRefForPoint(i)) &&
        selection.has(refForPoint(i))
      ) {
        out.add(i);
      }
    }
    return out;
  }, [data, annotationRefs, selection, fineRefForPoint, refForPoint]);

  const handleClickPoint = useCallback(
    (pointIndex: number, ctrlKey: boolean) => {
      if (!data) {
        return;
      }
      const selRef = refForPoint(pointIndex);
      const fineRef = fineRefForPoint(pointIndex);

      if (!ctrlKey) {
        // Replace both channels with just this one point.
        setSelection(new EntityRefSet([selRef]));
        setAnnotationRefs(new EntityRefSet([fineRef]));
        return;
      }

      // Ctrl-toggle, preserving annotated ⊆ selected. Decide add-vs-remove from
      // the current selection (read via selectionRef so the callback identity
      // stays stable). On add: append the fine ref. On remove: drop EVERY
      // annotation ref whose selection-grain projection is the removed ref —
      // under collapse that clears all of a model's contacted pairs, so a model
      // never keeps labels after it leaves the selection. If selection is null,
      // the toggle starts a new one containing just this point (matching the
      // pre-refactor behavior).
      const wasSelected = (selectionRef.current ?? new EntityRefSet()).has(
        selRef
      );

      if (wasSelected) {
        setSelection((current) =>
          (current ?? new EntityRefSet()).delete(selRef)
        );
        setAnnotationRefs((current) => {
          if (!current) {
            return current;
          }
          const selKey = entityRefKey(selRef);
          let next = current;
          current.forEach((ref) => {
            if (entityRefKey(projectToSelectionGrain(ref)) === selKey) {
              next = next.delete(ref);
            }
          });
          return next;
        });
      } else {
        setSelection((current) => (current ?? new EntityRefSet()).add(selRef));
        setAnnotationRefs((current) =>
          (current ?? new EntityRefSet()).add(fineRef)
        );
      }
    },
    [data, refForPoint, fineRefForPoint, projectToSelectionGrain]
  );

  const handleMultiselect = useCallback(
    (pointIndices: number[]) => {
      if (!data || pointIndices.length === 0) {
        return;
      }
      // The renderers have already confined `pointIndices` to a single group
      // when enforceSingleGroupSelection is on, so these are exactly the points
      // the box touched. selection collapses by grain; annotation keeps them at
      // fine grain.
      setSelection(new EntityRefSet(pointIndices.map(refForPoint)));
      setAnnotationRefs(new EntityRefSet(pointIndices.map(fineRefForPoint)));
    },
    [data, refForPoint, fineRefForPoint]
  );

  const clearSelection = useCallback(() => {
    setSelection(null);
    setAnnotationRefs(null);
  }, []);

  // Set selection from a resolved context (the "set selection from a context"
  // panel action). The context names index entities (models), so selection is
  // their single refs — INCLUDING any with no point currently in view (they
  // belong in the panel even if unplotted). Annotation, which can only label
  // points that exist, gets one REPRESENTATIVE per selected ref: the first
  // matching point, captured at fine grain. annotated ⊆ selected holds (reps
  // are a visible subset). Returns the representative point indices so the
  // caller can position their annotations before the next render. Under
  // group_by === "expansion" that's one point per model; on a plain plot it is
  // every selected point (one per id), i.e. the prior behavior.
  const setSelectionFromContext = useCallback(
    (indexIds: string[]): number[] => {
      const selSet = new EntityRefSet(indexIds.map(singleRef));
      setSelection(selSet);

      const reps: EntityRef[] = [];
      const repPoints: number[] = [];
      if (data?.index_ids) {
        const seen = new Set<string>();
        for (let i = 0; i < data.index_ids.length; i += 1) {
          const selRef = refForPoint(i);
          const key = entityRefKey(selRef);
          if (!seen.has(key) && selSet.has(selRef)) {
            seen.add(key);
            reps.push(fineRefForPoint(i));
            repPoints.push(i);
          }
        }
      }
      setAnnotationRefs(new EntityRefSet(reps));
      return repPoints;
    },
    [data, refForPoint, fineRefForPoint]
  );

  // Stable selection key for the point at `pointIndex`, in the CURRENT grain.
  // Exposed so the wrappers' stale-ref cleanup effect builds valid keys the
  // same way selection refs are built. Without this, a model-grained selection
  // (group_by === "expansion") would be measured against pair keys the wrapper
  // computed from `data.expansions` and get wiped on every data change.
  const selectionKeyForPoint = useCallback(
    (pointIndex: number) => entityRefKey(refForPoint(pointIndex)),
    [refForPoint]
  );

  return {
    selection,
    selectedPoints,
    pointsToAnnotate,
    handleClickPoint,
    handleMultiselect,
    setSelection,
    setSelectionFromContext,
    clearSelection,
    selectionKeyForPoint,
  };
}
