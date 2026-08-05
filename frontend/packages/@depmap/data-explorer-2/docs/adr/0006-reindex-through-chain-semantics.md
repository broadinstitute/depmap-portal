# ADR 0006 — `reindex_through` chain semantics and traversal model

- **Status:** Accepted
- **Applies to:** `@depmap/data-explorer-2`, `@depmap/selects` (chain picker),
  `@depmap/slice-table`, `@depmap/types` (`SliceQuery`), and the Breadbox backend chain
  resolver (Python — outside this module's tree, see Consequences)
- **Key symbols:** `SliceQuery.reindex_through`, `ChainColumnPicker`, `computeLevel`,
  `buildExtendedMetadata`, `canEvaluateLocally`, `resolveDisplayLabel`, Breadbox's chain
  resolver, the `in_context` operator

---

## Context

DepMap datasets are indexed by many dimension types (screens, screen pairs, models,
compounds, genes, transcripts, ...) that reference each other via foreign keys in their
metadata tables. Users routinely want data indexed by one type in terms of a column that
only exists on a related type — e.g. model lineage information for rows indexed by
`screen_pair`, reached by hopping `screen_pair` → `screen` (via `CtrlArmScreenID` /
`TestArmScreenID`) → `model`. `reindex_through` is the name for that traversal and
everything built around it.

It was implemented across the whole stack — the Breadbox chain resolver (fan-out/dedup
for list-valued FKs, the `in_context` operator), the `SliceQuery` type, the
`dataExplorerAPI` service layer, and `AnnotationSelectV2` / `ChainColumnPicker` — over a
series of commits, and none of the resulting model was written down. The shape is not
reconstructable by reading the type definition alone, and it has already generated one
instance of a rule that looked like a safe simplification and turned out to be wrong: the
blanket "hide `label`" rule in the chain picker, which quietly assumed `label` was a
single global column instead of a per-type one. That's the trigger for this record.

## Decision

### 1. Root vs. leaf: the outer `SliceQuery` always describes the data actually being fetched

A `SliceQuery` with a populated `reindex_through` describes data belonging to the type at
the **end** of the chain (the leaf), never the origin index type (the root).
`dataset_id` / `identifier` / `identifier_type` on the outer object are the leaf's real
column; `reindex_through` exists purely to say how to get from the origin dimension to
that leaf, one FK hop at a time. Metadata lookups (`value_type`, `col_type`,
`references`) must resolve against the leaf, never the root.

### 2. Nesting direction is inverted from traversal order

This is the part most likely to be gotten backwards. A 3-level chain — origin
`screen_pair`, first hop `anchor_screen_id` into `screen`, second hop `gene_fk` into
`gene`, landing on `gene`'s own `label` — has this shape:

```
{
  dataset_id: "gene_metadata", identifier: "label",            // the leaf
  reindex_through: {
    dataset_id: "screen_metadata", identifier: "gene_fk",       // hop taken LAST, nearest the leaf
    reindex_through: {
      dataset_id: "screen_pair_metadata", identifier: "anchor_screen_id"  // hop taken FIRST, nearest the origin
    }
  }
}
```

The link attached directly to the outer object is the hop adjacent to the leaf (taken
last by the user); the most deeply nested link is the hop adjacent to the origin (taken
first). Reading the structure top-to-bottom walks the chain leaf-to-root — backwards from
how the user built it. Anything that reconstructs traversal order (chain-picker display,
`resolveDisplayLabel`) must collect hops in that leaf-to-root order and reverse before
presenting root-to-leaf. Getting this backwards doesn't fail loudly: it silently reverses
the displayed hop order, and if fed into the resolver in the wrong direction, resolves
against the wrong intermediate type.

### 3. `label` is a per-type column, not a global one

Every dimension type's own metadata table carries its own `label` column. A `label`
selected at the root (depth 0) is an ordinary, unchained `SliceQuery`. A `label` selected
after one or more hops is a **different** column belonging to the type at the end of that
chain, and must carry `reindex_through` like any other column selected at that depth.

We previously hid `label` unconditionally from the chain picker's candidate columns,
which looked like a reasonable simplification and was actually papering over this
distinction. Once traversal made `label` reachable at multiple depths in one session, the
blanket hide — and, separately, matching a selection by `identifier === "label"` rather
than the full query — produced real bugs: dropped filter variables, collided
preview/table lookups, and an inability to tell which of several identically-named picker
rows was selected.

The fix is structural equality everywhere a `label` selection is identified or matched —
full `SliceQuery` comparison (`dataset_id` + `identifier` + `reindex_through` chain),
never a bare `identifier` string. This generalizes: any exemption in this codebase keyed
on `identifier === "label"` is suspect unless it also checks `reindex_through` is absent.

### 4. Auto-traversal is cardinality-driven, not manually annotated

Whether a hop through a given FK is silent (auto-traversed) or requires an explicit
"door" choice in the picker falls out of the schema: **one** FK column on a type
targeting a given dimension type auto-traverses silently; **two or more** FK columns on
the same type targeting the same dimension type are presented as explicit doors, because
which one to follow is now a real decision the picker can't make for the user. This is
why `screen_pair`'s two screen-referencing columns are doors, while a single FK to `gene`
is not.

### 5. Convergent (hub) types are not chains

Two dimension types that are both FK children of some hub type are not thereby chainable
to each other. Reversing a hop backward out of a hub reintroduces fan-out unless
uniqueness at that hub is actually guaranteed, and `reindex_through` has no mechanism for
asserting that. Where this was hit in practice (isoform/protein-structure queries against
`transcript`), the resolution was a direct column (`transcript.protein`, isoform-
qualified) rather than a transitive join through a shared hub. This is a modeling
default, not an absolute rule — but "add a direct column" is the default, and "traverse
backward through a hub" needs a specific uniqueness argument to override it.

### 6. The backend resolver owns fan-out/dedup; the frontend must not shortcut around it

List-valued FK columns fan out during traversal, and deduplicating the result is
chain-resolver logic that lives in Breadbox, exposed via the `in_context` operator (kept
distinct from `in` specifically because the fan-out/dedup semantics differ).
`evaluateContext()`'s frontend-side local-evaluation optimization — which skips a REST
round-trip for simple list-membership checks — must never take that shortcut for a query
with `reindex_through` populated, because the frontend has no fan-out/dedup logic of its
own to fall back on. The guard (`canEvaluateLocally`) is an **allowlist**: local
evaluation is opt-in per case, default-deny, rather than a blocklist of known-bad cases.
New disqualifying cases (nested `{context}` references, complement handling, null-safe
operators) are additions to a deny-by-default rule, not new blocklist entries.

## Consequences

- Any future column-hiding or column-matching logic that keys off a bare `identifier`
  rather than full structural `SliceQuery` equality is a latent bug, not a
  simplification. `label` is the instance that already proved it, but the same trap
  exists for any column name that recurs across dimension types.
- `resolveDisplayLabel`, and any future chain-walking display code, must treat
  leaf-to-root as the internal nesting order and reverse explicitly for root-to-leaf
  display. Do not "fix" the walk to go the other direction without re-deriving why it's
  backwards in the first place (§2).
- `canEvaluateLocally`'s allowlist shape is a deliberate ongoing cost: every new
  frontend-local shortcut must be justified into the allowlist rather than merely
  not-yet-blocklisted. Reverting it to a blocklist would silently reopen the
  reindex_through-bypass bug it exists to prevent.
- This decision spans the Breadbox backend (Python — the chain resolver and `in_context`
  operator) as well as several frontend packages. It's recorded here, in
  `data-explorer-2`, following this repo's existing precedent for wire-format/contract
  ADRs (see 0001), but the backend half currently has no equivalent home. If
  `breadbox/docs/adr/` is ever started, §1, §2, and §6 should be cross-linked from there
  — reversing the resolver's behavior would require changing Python code this ADR
  doesn't live next to.

## Related

- **ADR 0001** — Schema versioning for `DataExplorerPlotConfig`. Same category of
  decision (a wire-format contract with consequences invisible in the type definition
  alone), and the precedent for keeping this kind of contract-level ADR in
  `data-explorer-2` even where the full picture spans other modules.
