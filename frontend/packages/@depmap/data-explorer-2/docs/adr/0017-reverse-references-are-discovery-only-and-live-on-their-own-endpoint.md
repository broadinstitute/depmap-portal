# ADR 0017 — Reverse references are discovery-only and live on their own endpoint

- **Status:** Accepted
- **Applies to:** Breadbox (`api/dimension_types.py`, `service/reference_graph.py`),
  `generating-de2-links.md` (Delphi's link rules)
- **Key symbols:** `GET /types/dimensions/{name}/referenced-by`,
  `matrix_datasets` on `GET /types/dimensions/reference-graph`,
  `relationship_from_child`, `relationship_from_parent`
- **Builds on:** ADR 0013 (route choice), ADR 0014 (the endpoints), ADR 0015 (fixture parity)

---

## Context

`reachable` follows forward foreign keys only (ADR 0014, decision 2), because that is all the
chain resolver accepts. A type that is _referenced_ by others, such as `compound_v2` by
`compound_dose.CompoundID`, therefore cannot see its children. An agent asked for ERLOTINIB
gene effect "by dose" concluded there was no per-dose data and plotted on `compound_v2`, when
the right type was `compound_dose`. Many rows of the child reference one row of the parent
(many-to-one from the child's side). The same shape covers timepoints, replicates, and any
other "many per entity" child.

Delphi also had no way to go from a matrix dataset to the types indexing it without one
`/datasets` call per dataset.

## Decision

1. **Reverse references get their own endpoint, `GET /types/dimensions/{name}/referenced-by`.**
   For the type, it lists every table of every type with a column referencing it: the table
   (with `is_primary`), the referencing column, `cardinality` from the child's side, the
   relationship from both sides (`many_to_one` / `one_to_many` for scalar columns,
   `many_to_many` for list columns), and the child table's own columns.
2. **It is not a `direction` parameter on `reachable`.** Every entry in `reachable` carries a
   `slice_query_template` that the resolver accepts, and that invariant is what lets Delphi
   copy a template verbatim. A reverse entry cannot honour it (decision 3), so mixing both
   directions would make "listed" stop meaning "usable in a chain". A separate response type
   makes the difference structural.
3. **Reverse edges carry no templates and no `offered_by_picker`.** The resolver
   (`_resolve_reindex_chain` / `_chain_step` in `service/slice.py`) loads each step as a
   column series keyed by that table's own dimension IDs and looks each cell's value up in
   the next series. A reverse hop would look up parent IDs in a series keyed by child IDs, so
   it cannot fan out, and there is no aggregation to collapse it. A test pins this. The
   picker never offers reverse routes either, so ADR 0013's parity rules are untouched and
   `offered_by_picker` keeps its meaning.
4. **Not a field on `reference-graph`.** The graph stays a per-type facts list; the reverse
   view is the same facts inverted, one call per type, and is only needed when asking about a
   particular type. Self-references are included here even though `reachable` omits them (a
   chain may not revisit a type).
5. **`reference-graph` gains `matrix_datasets`.** One entry per visible matrix dataset:
   ids, `slice_dataset_id`, name, `data_type`, `feature_type`, `sample_type`. Tabular datasets
   are already listed under their type. A consumer maps dataset → type name → node in
   `dimension_types` / `reachable` / `referenced-by` with no `/datasets` call.
6. **No dose-level-matrix field.** A matrix indexed by `compound_dose` cannot be used on a
   `compound_v2` axis: `reindex_through` re-keys a _metadata column_ onto the index type, and
   going from many doses to one compound is an aggregation the resolver does not have.
   Nothing the endpoints could say would be usable, so they say nothing. The consumer reads
   `referenced-by` for the child type, finds matrices whose `feature_type` or `sample_type`
   is that child in `matrix_datasets`, and **plots at the child level**: the axis is the child
   type, and the parent's columns can be brought in with an ordinary forward template from
   the child (`compound_dose` → `compound_v2` via `CompoundID`). Aggregating doses is the
   user's request to make explicitly and is not something Delphi may infer.

## Considered options

- **`direction=reverse` on `reachable`.** Rejected (decision 2).
- **Reverse nodes on `reference-graph`.** Duplicates every edge in the payload for a question
  asked about one type at a time. Rejected.
- **A `reindex_through` flavour that aggregates.** Needs semantics (which dose? mean? max?)
  that were never decided. Rejected; this would be a data-model decision, not an endpoint one.
- **A `dose_level_datasets` field on reverse entries.** Convenience over a join the consumer
  can do from `matrix_datasets`. Deferred until it is a demonstrated pain.

## Consequences

- **Good:** an agent can discover child types, and the failure that motivated this has a
  documented path. "Never hand-build chains" still holds; the reverse view hands out facts,
  not queries.
- **Good:** `reachable` is unchanged, so ADR 0015's fixtures and the picker contract are too.
- **Bad:** one more call is needed to find dose-level data (`referenced-by`, then
  `matrix_datasets`). Transitive children (a child of a child) need another call per level.
- **Bad:** cardinality is the child's _column shape_, not a guarantee. `many_to_one` may in
  fact be one-to-one; uniqueness is not recorded.
- **Good:** `compound_dose` (id column `CompoundDoseID`, `CompoundID` → `compound_v2`, with a
  `Dose` column) is in `schema.json` from a real instance, so the many-to-one case is covered
  without a hand-written entry. ADR 0015's "nothing is written by hand" holds.
- **Neutral:** the wire change is additive (`matrix_datasets` is a new response field,
  `referenced-by` a new route), so the client only needs regenerating to use them.
