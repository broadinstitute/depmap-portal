# Filtering by data availability — proposal

**Status: investigated and deferred (2026-09-03). Not being built.**

This records a design that was worked out and then shelved as not worth its complexity. It
exists so the next person to want this feature starts from the difficulties rather than
rediscovering them. Nothing here is implemented.

# The problem

Users want to restrict a set of samples or features to those that actually appear in data they
can see. Two situations produce the ask:

- Building a context for a comparison plot and getting back entities that have no measurements
  in any dataset the plot could use, so the "group" is partly hollow.
- Wanting a reusable, saveable "genes we actually have CRISPR data for"-style filter, optionally
  narrowed to a named set of datasets.

There is no way to express this today, and the reason is structural rather than accidental.

# Why it doesn't fall out of what already exists

`ContextEvaluator` (`breadbox/breadbox/depmap_compute_embed/context.py`) has one data model:
`vars` name slice queries, each slice is eagerly loaded into a `{given_id: value}` dict, and the
JsonLogic `expr` is evaluated once per candidate entity against those values.

Every predicate it supports is therefore a function of **slice values**. "Does this entity
appear in some dataset" is not a slice value — it is a property of the dataset inventory, which
the evaluator has no access to and, by design, no DB session for. (`depmap_compute_embed` is
deliberately DB-free; that is why `get_slice_data` and `get_labels_by_id` are injected
callables.)

Adjacent questions are already answered elsewhere, and neither is reusable here:

- `GET /datasets/?feature_id=&feature_type=` — which datasets contain one entity. One round trip
  per entity.
- `count_dataset_coverage` (`breadbox/breadbox/crud/dataset.py`) — for a list of entities, how
  many each visible dataset contains. Aggregated per _dataset_, not per _entity_.

# The scope fork that governs everything: two different questions

"Can be found in a dataset" is ambiguous, and the two readings differ by orders of magnitude in
cost.

**1. Is the entity on the axis of a visible dataset?** A row-existence query against
`DatasetFeature` / `DatasetSample`. One indexed SQL query. Cheap.

**2. Does the entity have a non-null value in a visible dataset?** Matrix values live in HDF5.
Answering this means reading the matrices.

**Breadbox stores nothing about nullity.** `DatasetFeature` / `DatasetSample`
(`breadbox/breadbox/models/dataset.py`) index the axis and carry no value statistics; there is
no null count, no density, no coverage summary anywhere in the models or CRUD layer. A feature
can sit on the axis of a matrix that is entirely NaN for it.

So question 2 has no cheap answer at any layer. It requires either a per-request scan of every
relevant matrix (a non-starter) or **new precomputation**: a nullity summary written at dataset
upload, plus a backfill migration for every dataset that already exists.

**This is the single largest cost in the entire feature, and it is independent of which option
below you pick.** Both options are inexpensive against question 1 and expensive against
question 2.

Whether the distinction matters in practice is an open empirical question. Most DepMap matrices
have their features filtered during preprocessing, so the two answers are probably close. But
"probably close" is doing real work in that sentence, and a filter that silently lies about a
handful of genes is worse than no filter.

# Option A — a new context expression

## Syntax

The instinct is a new JsonLogic operator evaluated per entity. That is wrong: the answer does
not depend on the entity's slice values at all, so it should be resolved once, for a set.

`ContextEvaluator` already has exactly that mechanism. `{"context": "<name>"}` is not a
JsonLogic node — `_resolve_context_refs` walks the tree during `__init__` and replaces it with a
flat id list _before_ evaluation. The proposal is a second resolvable reference node riding the
existing `in_context` operator:

```json
{ "in_context": [{ "var": "given_id" }, { "has_data": {} }] }
```

with a whitelist:

```json
{
  "in_context": [
    { "var": "given_id" },
    { "has_data": { "datasets": ["Chronos_Combined", "..."], "match": "any" } }
  ]
}
```

Notes on the shape:

- **`dimension_type`** must be an optional field on the node, defaulting to the enclosing
  context's. A non-`given_id` LHS (a column of compound ids, say, possibly reached through a
  `reindex_through` chain) needs the id set computed for _that_ dimension type. Nested
  `{"context": ...}` refs already carry theirs in the nested definition, so this is symmetric.
- **`match: "any" | "all"`** should be designed in from the start rather than retrofitted.
  "Models measured in both CRISPR and RNAi" is a common comparison-plot setup, and it is just an
  intersection instead of a union.
- **Naming.** If this is built against question 1, `has_data` overclaims. `in_dataset` or
  `on_axis_of` is the honest name.

## Mechanics

- A third injected loader on `ContextEvaluator.__init__`, alongside `get_slice_data` and
  `get_labels_by_id`, keeping `depmap_compute_embed` DB-free:
  `Callable[[str, Optional[list[str]]], set[str]]`.
- A `_resolve_data_refs` pass mirroring `_resolve_context_refs`, run in `__init__` before
  `_resolve_complements`, threaded through recursive construction of inner contexts. Memoize on
  `(dimension_type, frozenset(datasets))`.
- A CRUD sibling of `count_dataset_coverage` returning ids instead of counts, reusing its
  access-control shape verbatim.
- Wire the loader in `_evaluate` (`breadbox/breadbox/api/temp/context.py`), where the other two
  request-scoped closures already live.

## What comes for free

This is the strongest argument for the reference-node shape:

- **Negation.** `!in_context` is already in `_NEGATED_OPS`, so "entities with no data anywhere"
  desugars into a null-guarded negation with no new code.
- **`complement`.** The auto-synthesized "NOT My Context" outgroup works unchanged.
- **Null guards.** `_resolve_complements` subtracts `given_id` when computing guards, so no
  spurious guard is added — correct, since `given_id` is never null.
- **Composition** inside `and` / `or` alongside ordinary predicates.
- **`_validate_var_refs`** is unaffected; no new vars.

## Difficulties

- **The persistent cache. This is the one that would bite.**
  `evaluateContextPersisted` (`frontend/packages/@depmap/api/src/persistedFetches.ts`) writes
  context results to IndexedDB, and per ADR 0008 the engine has _no invalidation logic at all_ —
  correctness rests entirely on the dependency set being fully enumerable and folded into the
  key. A `has_data` result depends on the whole visible dataset inventory, which is exactly as
  unenumerable as the `reindex_through` case `collectDimensionTypeNames` already bails on.
  Without a matching bail, adding a dataset yields stale hits that survive reloads. The fix is
  one line and precedented — return `null` when the walk sees a `has_data` node — but it must
  not be forgotten, and it is invisible from the backend code.

- **Access control is an existence oracle.** A whitelisted dataset the user cannot see must be
  _silently dropped_, never raised as "unknown dataset" — that would leak the existence of
  private datasets, which the 404-vs-403 convention exists to prevent. The consequence is that a
  shared context genuinely means different things to different users. Arguably the feature, but
  it needs to be a stated decision and probably surfaced in the UI.

- **Purity.** Every expression the evaluator supports today is a pure function of slice values:
  same input, same answer, for everyone, forever. This would be the first that varies by user
  and drifts as datasets are added. Contexts are meant to be portable and shareable, and that
  assumption is load-bearing in places that don't mention contexts.

- **Wire format.** Saved contexts are persisted. An older portal reading a `has_data` node
  encoded under `in_context` renders it as "is in context" with an empty picker — silently
  wrong. Failing loudly instead is an argument for a distinct operator name (`getOperator` in
  `ContextBuilderV2/utils/expressionUtils.ts` throws on unrecognized operators); on the backend a
  distinct operator is a handful of lines aliasing `_in_context` plus a `_NEGATED_OPS` entry.

- **Smaller items.** Dataset ids arrive as both UUIDs and given_ids and both must resolve.
  Restrict to `MatrixDataset` as `count_dataset_coverage` does — a gene as a row in a metadata
  table isn't data. `evaluate()`'s `num_candidates` still counts the full universe, so
  "1,203 of 20,000" reads oddly next to a has-data filter.

# Option B — a SliceTable custom column

Show, per row, which public datasets the entity has data for. Weaker than filtering, but far
less machinery.

## Most of the frontend already exists

`SliceTable` already accepts a `customColumns` prop
(`frontend/packages/@depmap/slice-table/src/components/useSliceTableState.tsx`, `CustomColumn`).
Supplying `accessorFn` is what enables sorting, search and CSV export, so "type a dataset name
into the search box, see only entities with that data" comes for free. No changes to
`useData.tsx`, no new extension point.

## Backend needed

`count_dataset_coverage` already computes the `(given_id, dataset_id)` pairs and then discards
the detail with `group_by` + `func.count`. A sibling returning the pairs is a small,
well-precedented change: the same `get_datasets(...)`-scoped visibility logic, minus the
aggregation. Plus a schema, an endpoint, and `./bb update-client`.

## Difficulties

- **Payload.** For an index of order 10⁴ entities against the public matrix datasets, a naive
  `{id: [name, ...]}` reaches multiple MB. Mitigation if it bites: a legend array of dataset
  names plus per-entity integer indices. Not worth optimizing before measuring.
- **It is a display affordance, not a filter.** The user can sort, search and export by it, but
  cannot turn the result into a saved context reusable in a plot. If that round trip is the real
  need, this defers the problem rather than solving it.
- **Naming.** Against question 1, label it "In datasets", not "Has data in".

## Why it is meaningfully cheaper

Scoping to **public** datasets makes the response user-invariant. That removes the
access-control-oracle problem entirely and defuses most of the caching hazard — though the
result still depends on the dataset inventory, so it should not be persisted without declaring
that inventory as a dependency.

# Performance considerations

- **Membership is a list scan.** `_in_context` requires `isinstance(b, list)` and does `a in b`.
  `evaluate()` runs the expression once per candidate. Resolved contexts are usually small, so
  this has been fine; a data-availability set is by definition close to the size of the whole
  universe, making a single clause O(n²) in the number of entities — order 10⁸ comparisons for a
  dimension type of order 10⁴.

  **Worth doing regardless of this proposal:** have the resolver return a `set` and widen
  `_in_context`'s type check to accept it. This improves the existing `{"context": ...}` path too
  and is independent of anything here.

- **Resolution cost** is one indexed SQL query per distinct `(dimension_type, datasets)` pair,
  memoizable — negligible next to the scan above.

- **The HDF5 wall.** Everything above is cheap only for question 1. Question 2 has no
  per-request-viable implementation; it is a precomputation project, not a query.

- **Client payload** (Option B): see above.

# Decision

Deferred. The added complexity is not justified by present demand.

If the need resurfaces, the cheapest first move is **Option B against axis membership** — the
frontend extension point exists, the CRUD change is small, and the public-only scope avoids the
access-control and caching hazards.

Before spending anything on precomputed nullity, **measure whether axis membership and non-null
coverage actually differ** across the public matrices. If they are close, question 1 is the
whole feature and the expensive half never needs building.

# Open questions if revisited

- How far apart are axis membership and non-null coverage in practice?
- Is a display-only affordance (Option B) sufficient, or is a saveable, reusable context the
  actual requirement?
- Should a data-availability context be user-varying at all, or should it be pinned to the
  public set so it stays portable?
- If precomputed nullity is built, does it belong on the dimension rows, in a side table, or in
  the HDF5 file itself?
