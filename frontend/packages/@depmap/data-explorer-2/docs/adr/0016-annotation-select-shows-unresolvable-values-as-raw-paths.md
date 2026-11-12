# ADR 0016 — AnnotationSelect shows unresolvable values as raw paths

- **Status:** Accepted
- **Applies to:** `@depmap/selects` (`AnnotationSelect/ChainColumnPicker.tsx`,
  `sliceQueryUtils.ts`)
- **Key symbols:** `checkValueResolves`, `deriveNavStateFromValue`
- **Builds on:** ADR 0013, ADR 0015

---

## Context

Links outlive the data they name. A month-old Delphi link can point at a dataset
that was removed, hidden, or is not visible to the viewer. `AnnotationSelect`
receives such a value and already avoids crashing: the trigger label comes from
the value alone, and failures fall back to the leaf identifier. But an
unresolvable step is skipped silently, so the label looks like an ordinary
selection (a bare column name) and the user cannot tell the value is dead.

Two different situations need separating:

1. **Resolvable but not offered.** Every step exists, but the route is not one
   the picker offers (ADR 0013). This already renders and labels correctly; it
   only loses the highlighted row. Nothing about it is wrong.
2. **Unresolvable.** A step names a dataset or column that is not in the
   loaded schema, or breaks the chain (wrong index type, non-FK hop).

## Decision

1. Add `checkValueResolves`, a pure check that each step's dataset is known,
   is indexed by the type the previous hop landed on, has the column, and (for
   intermediate steps) that the column is a foreign key.
2. When it fails, the trigger shows the **raw path** (every step's identifier,
   joined with " › ") in muted, struck-through italics, with the reason in a
   tooltip. The clear button works as usual.
3. The value is **never altered or cleared automatically**. The component is
   controlled, and a transient schema failure must not destroy a saved choice.
4. Case 1 is unchanged. The check does not consult `computeLevel`.
5. The check applies only to `ChainColumnPicker`. Matrix leaves are handled by
   `MatrixAnnotationPicker` and are out of scope.

## Considered options

- **Do nothing.** Dead values look valid. Rejected.
- **Clear unresolvable values.** Loses the user's choice on a schema hiccup, and
  hides what the link asked for. Rejected.
- **Replace the picker with a read-only error.** Heavier, and the user could not
  re-choose in place. Rejected.
- **Validate in Delphi only.** Worth doing too, but it cannot help links that
  are already out there or viewers with different visibility.

## Consequences

- **Good:** a dead link is visibly dead, and says why on hover.
- **Good:** the check is pure and unit tested; unoffered routes are unaffected.
- **Bad:** datasets passed in `hiddenDatasets` are removed from the schema the
  picker sees, so a value that points at one is shown as unresolvable.
- **Bad:** the raw path shows identifiers, not display names, since the names
  are exactly what could not be looked up.
- **Neutral:** nothing downstream of `onChange` changes; consumers still receive
  the value they passed in.
