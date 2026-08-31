# ADR 0008 — Persisting API responses is a per-call-site assertion

- **Status:** Accepted
- **Applies to:** every consumer of `@depmap/api` — Data Explorer most of all, but the
  decision is portal-wide. Recorded here because this is where design decisions live and
  because new Data Explorer call sites are where the question will keep coming up.
- **Key symbols:** `cached(api, { persist })`, `PersistOption`, `initDatasetRegistry`,
  `buildPersistentKey`, `CACHE_VERSION`, `evaluateContextPersisted`,
  `getDimensionTypeIdentifiersPersisted`, `getPersistentApiCacheInfo`

---

## Context

`cached()` has always deduplicated requests in memory, for the life of a page. It now
additionally supports persisting responses to IndexedDB, so they survive reloads. The
whole design derives from one paragraph:

> Breadbox never mutates dataset data in place. A new version of a dataset is a new row
> with a new UUID, and `PATCH /datasets/{id}` changes metadata only — never data, never
> the UUID. Therefore a response addressed by dataset UUID is immutable, and a cached
> copy of it is valid forever.

Consequently the engine (`@depmap/api/src/persistentApiCache.ts`) has **no invalidation
logic** — no TTL, no revalidation, no version comparison on read. Everything a response
depends on is folded into its _key_: a given_id (a mutable pointer to "latest") gets its
resolved UUID appended, and declared deps are appended likewise, so when a dependency
changes the key changes and the old entry is orphaned — a miss, never a wrong hit. LRU is
the TTL. Only datasets in the public group are ever written, because IndexedDB is
origin-global and user-agnostic (shared machines, logout, user switching). Until the
entry points seed the registry from a fresh `getDatasets()`, the engine fails closed.

A persistent cache is the first thing in this stack where "just reload" does not clear a
bad state. Every rule below exists to keep wrong entries from being _written_, because
nothing ages them out.

## Decision

**Persistence is opted into at each call site, and the opt-in is an assertion: "every
dataset contributing to this response is named in the request or declared in `deps`."**

```ts
cached(breadboxAPI, { persist: true }).getMatrixDatasetData(id, args);
```

### 1. Why per-site, not per-method

A method-name registry ("always persist `getMatrixDatasetData`") would cover today's
call sites with six entries. It was rejected because the engine cannot always tell when
the assertion is false. The canonical counterexample is `fetchAssociations`: its cache
key contains a dataset address, but its response is assembled from
`PrecomputedAssociation` rows with independent lifecycles plus label lookups against
another dimension type's metadata — none of which is named in the request. A registry
would silently persist every future call to a listed method, wherever it appears; a
per-site option makes a human affirm the assertion each time.

The accepted cost: **a new call site defaults to not persisting.** That is the safe
direction. When you add a Data Explorer call site, decide explicitly.

### 2. How to decide for a new call site

- **The request names its dataset(s)** (matrix/tabular/features/samples/dimension-data
  endpoints): add `{ persist: true }`. The engine independently verifies there is a
  dataset address in the key and that every involved dataset is public; if not, it
  quietly stays in-memory only.
- **`evaluateContext`:** call `evaluateContextPersisted(context)` instead of
  `cached(breadboxAPI).evaluateContext(context)`. The var `dataset_id`s are already in
  the key (the POST body is the key); the helper declares the _implicit_ dependencies —
  the metadata dataset behind the context's `dimension_type`, and nested contexts',
  recursively — and bails to plain in-memory caching when it can't enumerate them
  (`reindex_through`, a type with no metadata dataset, or a malformed tree). The bail
  path must never throw: interactive editors (Context Builder) evaluate
  partially-built contexts with holes and undefined nested entries, and the plain
  call this wraps would have sent those to the server and let them fail there.
- **Unfiltered `getDimensionTypeIdentifiers`:** call
  `getDimensionTypeIdentifiersPersisted(name)`. Its response depends only on the
  dimension type's metadata dataset, which Breadbox guarantees is public and gets a new
  UUID on every content change — so the declared dep is exact.
- **Filtered `getDimensionTypeIdentifiers`** (`data_type`,
  `show_only_dimensions_in_datasets`): **never persist.** The backend filters through
  the _user's_ accessible datasets, so the response is per-user. Keep plain `cached()`.
- **Never persist:** `fetchAssociations` (see above), `getTaskStatus` (mutable by
  nature), and the bootstrap methods
  `getDatasets` / `getDimensionTypes` / `getDataset`. The last three are not merely
  "not worth it": the correctness argument
  _requires_ `getDatasets` to be fresh every load (it seeds the registry and populates
  pickers — deletion handling exists only because of this), `getDimensionTypes` is the
  source the persisted helpers resolve deps from, and `getDataset` returns metadata
  that is PATCH-able under a stable UUID.
- **`getContextDatasetCoverage` — the whole-catalog case, and what it taught us.**
  Its request is the same Context body `evaluateContext` takes and it runs the same
  evaluator, so the analogy invites `persist: true` someday. Don't: the assertion
  fails on the _response_ side. Coverage is computed across the caller's entire
  accessible catalog — datasets named nowhere in the request — and user identity
  arrives via proxy headers the cache key can never see. It persists via
  `persist: { wholeCatalog: true }` instead, which makes the dependency explicit
  and lets the engine decide per session:

  - **Only when the caller's entire visible catalog is public.** This is the
    load-bearing invariant, and it is about BYTES, not keys: IndexedDB is
    readable wholesale (devtools, shared machines), so no keying scheme can make
    a private-derived response safe to store. For an all-public caller the full
    response is derived from public data alone, so storing it discloses nothing.
    Anyone who can see a private dataset stays in-memory only, permanently.
  - **Keyed by a fingerprint of the listing.** Coverage depends on what exists
    _right now_, and datasets are uploaded at runtime where the epoch offers no
    protection — but the registry is rebuilt from a fresh `getDatasets()` every
    page load, so folding a hash of the sorted listing UUIDs into the key makes
    entries self-invalidate on any catalog change, the same way given_id keys
    do. (Since UUIDs pin contents, the fingerprint pins the entire input.)

  An earlier revision of this bullet presented both objections as absolute. Only
  the bytes-on-disk one is; the catalog-time one is answerable by the key. If a
  future endpoint needs full-fidelity persistence for private-visible users too,
  that requires server-side changes (a public/private scope split) — the client
  alone cannot express it.

Misclassifying in the safe direction (not persisting something immutable) costs a cache
hit. Misclassifying in the unsafe direction is the only real hazard, and the engine's
refusal checks cannot catch every case — that is precisely why the opt-in is a human
assertion.

### 3. The kill switch

The epoch is `v${CACHE_VERSION}:bb${breadboxVersion}`, compared once per page load; any
mismatch wipes the whole store.

- The **Breadbox app version** (from `GET /health_check/basic`, auto-bumped by
  commitizen on every `feat`/`fix(breadbox)` commit) handles backend changes
  automatically: if the server code that produced the cached bytes changed, the cache
  is gone on next load. A change to response _semantics under an identical request_
  (e.g. how an aggregation is computed) is covered as long as it ships as a
  version-bumping commit type.
- **`CACHE_VERSION`** in `persistentApiCache.ts` is the manual knob for frontend-side
  cache fixes: key-scheme changes, deps-computation bugs, anything that may have
  _written_ bad entries. Bump it in the same commit as the fix.
- There is deliberately **no feature flag and no operator value**. Rollback is
  reverting the code; frontend-only deploys leave caches warm.

Rule of thumb: _same request, different answer → something must bump; different
request → the key already did the work._

### 4. Traps that are already contained (do not "simplify" them away)

- The ambient `cacheOn`/`cacheOff` context is dynamic scoping. It works because every
  layer between the decorator and `getJson`/`postJson` is synchronous up to the point
  the request is issued, and `createJsonClient` captures the context into a local
  before any `await`. Keep it that way.
- `evaluateContext` has a client-side fast path that issues
  `getTabularDatasetData`/`getDimensionTypeIdentifiers` before its first `await`, so
  those inner calls inherit the outer persist context. This is safe _because_
  eligibility is judged per-request from each call's own key, not from what the outer
  call claimed — and it is where much of `evaluateContextPersisted`'s value lives, since
  locally-evaluated contexts make no `/temp/context` round trip at all.
- A plain `cached(api)` call maps to a context of `{ persist: undefined }`, never
  `null` — `null` means "not inside `cached()` at all" and disables the in-memory
  cache entirely. (This was once wrong, and every non-persisted request on every page
  refetched on each use.)
- The entry points call `initDatasetRegistry` synchronously with the _pending_
  `getDatasets()` promise, not the resolved listing. The engine's init promise must
  exist before the page's first persisted request; otherwise every request issued
  during that round trip sees an uninitialized engine and refuses — silently, on
  every load, which is how it originally shipped. `refusedNotReady` climbing is the
  symptom.
- The seed goes through `cached(breadboxAPI).getDatasets()` so it shares one request
  (and one listing) with every app caller. That is safe only while `getDatasets`
  never gains a `persist` option: a persisted call awaits the registry this very
  promise seeds, which would deadlock. An earlier comment called the shared form
  "circular" outright — the circularity is real only for the persisted path, which
  the never-persist rule above already forbids.

## Consequences

- New Data Explorer fetches get cross-reload caching by adding one option or calling
  one helper — but only if the author remembers; the default is in-memory only.
- `getPersistentApiCacheInfo()` (importable from `@depmap/api`, callable in a console)
  reports hit/miss/eviction/refusal counters; the `refused*` stats are the first place
  to look when an expected persist isn't happening.
- Tests live in `@depmap/api/src/__tests__/` and pin the refusal branches, key
  augmentation, LRU/quota behavior, epoch wipes, and the helpers' bail conditions. The
  engine holds module-level state; use `__resetForTests()` when testing against it.
