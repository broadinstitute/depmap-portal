# ADR 0014 — Breadbox exposes the dimension-type reference graph and reachable chains

- **Status:** Accepted
- **Applies to:** Breadbox (`api/dimension_types.py`, `service/reference_graph.py`,
  `service/reachable.py`), `@depmap/selects` (`AnnotationSelect`), and
  `generating-de2-links.md` (Delphi's link rules). Extended by ADR 0017 (reverse view,
  matrix datasets).
- **Key symbols:** `GET /types/dimensions/reference-graph`,
  `GET /types/dimensions/{name}/reachable`, `slice_query_template`,
  `offered_by_picker`, `computeLevel`, `picker_offers`
- **Builds on:** ADR 0003 (the link doc is a versioned contract), ADR 0006 (chain
  semantics), ADR 0013 (route choice). Breadbox has no ADR series of its own, so this
  record lives with the Data Explorer ADRs, as ADR 0006 does.

---

## Context

Delphi emits `SliceQuery`s with `reindex_through` in Data Explorer links. Until now it
built the chains by hand from prose rules in `generating-de2-links.md`, and the
definition of "reachable" existed only inside `AnnotationSelect`, which derives the graph
client-side from `GET /datasets`. Nesting runs opposite to traversal order, and building
chains by hand has already produced a bug. Every link Delphi mints must be one the picker
can render as its own selection, so the two must agree.

## Decision

1. **Two endpoints.** A facts endpoint (`reference-graph`): every dimension type, its
   visible tabular tables with the primary flag, and each reference column with scalar or
   list cardinality. A reachable endpoint (`{name}/reachable`): per index type, every
   reachable table grouped by route, with a `slice_query_template` Delphi uses verbatim.
   Delphi constructs no chains.
2. **Validity is the resolver's; presentation is not applied.** A route is listed when
   the resolver in `service/slice.py` accepts it: forward FK hops only, scalar or
   list-valued, no revisiting a type, at most `_MAX_REINDEX_DEPTH` objects (so
   `max_depth` is capped at 9 hops, default 4). Doors versus auto-traversal and collapsed
   labels are not applied; an agent needs every route.
3. **Every distinct route is listed; `offered_by_picker` marks the ones the picker also
   offers.** The flag is computed by a straight Python port of the picker's rules
   (`picker_offers`, mirroring `computeLevel` and ADR 0013). Delphi prefers flagged
   routes. A cross-language contract test (a later change) asserts the port and the
   TypeScript agree.
4. **Intermediate hops start from the primary table of each type; start tables may be any
   table at the index type.** This matches the picker. Supplemental tables are listed as
   start tables and as end tables, but their own references are not followed.
5. **List-valued hops are listed**, with `cardinality: "list"` and `result_is_list` so
   the consumer uses `has_any` / `in_context`, never `==`.
6. **Templates omit `identifier`.** A template is `dataset_id` (`given_id || id`),
   `identifier_type: "column"` and the nested chain, innermost hop first; Delphi adds one
   of the listed column names and nothing else.
7. **Permissions are per caller and uncached.** Both endpoints derive everything from the
   datasets visible to the requesting identity. Delphi uses the service account (public
   data only) for now; building it per identity means user-scoped access later cannot
   leak private tables. The computation is cheap, so there is no cache to key by group.
8. **`AnnotationSelect` is not migrated onto the endpoints.** The overlap is the validity
   rules and `SliceQuery` construction; those are stable, and a migration adds churn and a
   network dependency for little benefit. The contract test is the parity mechanism. The
   trigger to consolidate is the first time it forces the same rule change in both places.

## Considered options

- **Migrate `AnnotationSelect` to the endpoints.** One implementation, but churn on a
  working, tested component. Rejected for now (decision 8).
- **Only emit routes the picker offers.** Always consistent, but hides valid routes an
  agent might need, and couples Delphi to a presentation rule. Rejected.
- **Emit the full chain with an `identifier` placeholder.** A sentinel value is easy to
  leak into a link. Rejected in favour of omitting the field.
- **Keep the rules in prose only.** Prose drifts fastest and cannot be tested.

## Consequences

- **Good:** Delphi stops hand-building chains; `generating-de2-links.md` can defer to the
  endpoint for reachability and keep only link-formatting rules.
- **Good:** every advertised route and column is checked against
  `POST /datasets/dimension/data/` by a round-trip test, so "advertised" cannot drift from
  "accepted".
- **Bad:** the picker's rules now exist twice (TypeScript and Python) until the contract
  test lands. Ordering uses code points in Python but `localeCompare` in TypeScript, which
  can disagree for mixed-case or punctuated column names.
- **Bad:** payload grows with graph size. Columns are listed once per table per route and
  depth is capped, but a deep `max_depth` on a richly connected type can be large.
- **Bad:** the picker lists a door found in an auto-traversed table (a "bubbled" door) as
  a door at the current level, but clicking it records no auto path, so `buildSliceQuery`
  names the wrong source table. `picker_offers` does not treat such routes as offered. This
  is a latent picker bug, not fixed here.
- **Neutral:** `reachable` is forward-only by design. The reverse direction is a separate,
  template-free endpoint (ADR 0017).
- **Neutral:** routes through supplemental tables as intermediate hops are not offered by
  the endpoint, matching the picker.
