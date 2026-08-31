import type { RowSelectionState } from "@depmap/react-table";

// Whether two row selections differ in what is actually selected.
//
// Deliberately compares *selected ids* rather than object keys. TanStack may
// represent a deselected row either by dropping its key or by leaving it behind
// with an explicit `false`, so `{a: true, b: false}` and `{a: true}` are the
// same selection expressed two ways. A key-based comparison calls them
// different, which produces spurious change reports in one direction and — when
// used to decide whether to notify a consumer — missed ones in the other.
export default function rowSelectionChanged(
  previous: RowSelectionState,
  next: RowSelectionState
) {
  const selectedIds = (state: RowSelectionState) =>
    Object.keys(state).filter((id) => state[id]);

  const before = new Set(selectedIds(previous));
  const after = selectedIds(next);

  return after.length !== before.size || after.some((id) => !before.has(id));
}
