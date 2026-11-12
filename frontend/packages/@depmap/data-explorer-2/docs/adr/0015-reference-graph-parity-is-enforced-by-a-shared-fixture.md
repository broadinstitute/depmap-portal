# ADR 0015 — Reference-graph parity is enforced by a shared fixture

- **Status:** Accepted
- **Applies to:** `@depmap/selects` (`AnnotationSelect`), Breadbox
  (`service/reachable.py`), `generating-de2-links.md`
- **Key files:** `breadbox/tests/fixtures/reference_graph/{schema,reachable}.json`,
  `refresh_schema.py`, `test_reachable_matches_contract_fixture`,
  `AnnotationSelect/__tests__/referenceGraphContract.test.ts`
- **Builds on:** ADR 0013 (route choice), ADR 0014 (Breadbox endpoints)

---

## Context

ADR 0014 left two implementations of "which chains can the picker offer": the
TypeScript in `computeLevel.ts` and a Python port behind `offered_by_picker`.
Delphi emits whatever Breadbox lists, and every `SliceQuery` in a link must be
one `AnnotationSelect` can render as its own selection, so a silent difference
between them produces links that work but have no highlighted row, or fail to
render.

The two cannot share code. They can share a schema and an expected answer.

## Decision

1. **One schema fixture, from the live API.** `schema.json` is a trimmed copy of
   `/types/dimensions` and `/datasets` (reference columns plus a few ordinary
   ones, anonymous caller). It covers a representative set of cases rather than
   the whole schema: `refresh_schema.py` lists a few root types, each chosen
   for the shape it exercises (doors, supplemental start tables, multi-hop
   chains, several routes to one type, list-valued references, a type with no
   primary table), and keeps everything they reference so every reference
   resolves. The script regenerates it from a running Breadbox. The snapshot in
   the original handoff was stale, so nothing is written by hand.
2. **One expected-answer fixture, owned by Breadbox.** `reachable.json` holds
   the endpoint's output for every dimension type at the maximum depth. A
   Python test rebuilds it from `schema.json` and fails on any difference;
   `UPDATE_CONTRACT_FIXTURES=1` accepts a change.
3. **The Jest test replays the picker.** For each type and start table it runs
   `computeLevel`, follows doors, builds queries with `buildSliceQuery`, and
   compares them structurally (`serializeSliceQuery`) to `reachable.json`.
4. **Failures are triaged by direction.**
   - A query flagged `offered_by_picker` that the picker does not offer is
     urgent: Delphi would mint an unrenderable link.
   - A query the picker offers that Breadbox does not flag (or does not list) is
     drift in the port, or a gap in the endpoint.
     Both are asserted, so offered routes must match exactly.
5. **Tie-breaks compare by code unit, not `localeCompare`.** Python orders by
   code point; `localeCompare` is locale-sensitive. Names that differ only by
   case or punctuation could win differently in the two languages. `computeLevel`
   now compares with `<`, which agrees with Python for every name in the
   schema.
6. **Column order is asserted irrelevant.** The Jest test reverses every
   table's columns and requires the same selections.

## Considered options

- **Generate fixtures in CI and diff.** Needs a running service in the frontend
  job. Rejected; the checked-in answer plus a Python test that regenerates it
  gives the same failure with no infrastructure.
- **Hand-written fixtures.** Reviewable, but they test what we imagine the
  schema to be rather than what it is. Rejected.
- **Migrate the picker onto the endpoint.** Still deferred (ADR 0014).

## Consequences

- **Good:** any rule change in one language fails a test until the other agrees.
- **Good:** the fixture is real, so shapes like list-valued references,
  supplemental start tables and multi-route targets are covered without
  contriving them.
- **Bad:** schema changes in production do not fail anything until someone
  refreshes `schema.json`. The contract covers the rules, not the live data,
  and a shape that only exists outside the chosen roots is not tested.
- **Bad:** `reachable.json` is still about 90 KB and churns when the schema is
  refreshed.
- **Bad:** the live schema has no door nested inside an auto-traversed table,
  so the latent bubbled-door picker bug from ADR 0014 is not exercised here.
- **Neutral:** `groupColumns` still sorts display names with `localeCompare`;
  that is presentation and not part of the contract.
