# ADR 0008 — Persisting API responses is a per-call-site assertion

- **Status:** Accepted
- **Applies to:** every consumer of `@depmap/api` — Data Explorer most of all, but the
  decision is portal-wide. Recorded here because this is where design decisions live and
  because new Data Explorer call sites are where the question will keep coming up.
- **Key symbols:** `cached(api, { persist })`, `PersistOption`, `initDatasetRegistry`,
  `buildPersistentKey`, `CACHE_VERSION`, `CACHEABLE_GROUP_NAMES`,
  `evaluateContextPersisted`, `getDimensionTypeIdentifiersPersisted`,
  `getPersistentApiCacheInfo`

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
  `persist: { publicCatalog: true }` instead, paired with `scope=public` on the
  request:

  - **The response must be public-derived, and the request is what makes it so.**
    This is the load-bearing invariant, and it is about BYTES, not keys:
    IndexedDB is readable wholesale (devtools, shared machines), so no keying
    scheme can make a private-derived response safe to store. `scope=public`
    narrows the count to the public group server-side, so the bytes are
    public-derived for every caller and the same for all of them. The engine
    cannot verify this — only the call site knows what it asked for — so
    `publicCatalog` is an assertion in the same class as `persist: true`.
  - **Keyed by a fingerprint of the public listing.** Coverage depends on what
    exists _right now_, and datasets are uploaded at runtime where the epoch
    offers no protection — but the registry is rebuilt from a fresh
    `getDatasets()` every page load, so folding a hash of the sorted public
    UUIDs into the key makes entries self-invalidate on any change to the public
    catalog, the same way given_id keys do. (Since UUIDs pin contents, the
    fingerprint pins the entire input.) The public subset, not the whole
    listing: a private upload cannot change a public-scoped response, so folding
    it in would evict a still-valid entry, and two users with different private
    access would key byte-identical responses apart.

  **What this replaced, and why.** The first version had no scope parameter. It
  asked for full-fidelity coverage and persisted the result only for callers
  whose _entire_ visible catalog was public (`persist: { wholeCatalog: true }`),
  leaving everyone who could see a private dataset in memory only, permanently —
  which at the Broad is most internal users, i.e. the rule disabled the cache for
  the people it was for. An earlier revision of this bullet also presented both
  objections as absolute. Only the bytes-on-disk one is; the catalog-time one is
  answerable by the key, and the bytes one is answerable by asking the server a
  narrower question.

  **The price, accepted deliberately.** A public-scoped response says nothing
  about private datasets, so the Data Version select cannot coverage-filter them
  — a private data version stays on offer whether or not it contains the
  context's entities. That is the pre-coverage behavior, and it fails in the safe
  direction: over-offering, never stranding the user on an empty list. The
  filter in `computeOptions.ts` therefore reads "absent from `counts`" two ways,
  as measured-and-empty for a public dataset and as unmeasured for a private one.

  The full-fidelity alternative — cache the public-scoped call and merge an
  uncached `scope=private` one over it — was rejected. Both calls pay the
  context evaluation, which is the expensive half, so a private-visible user
  would still make a live round trip on every context change: the caching would
  buy them nothing while doubling cold-load work on the server.

Misclassifying in the safe direction (not persisting something immutable) costs a cache
hit. Misclassifying in the unsafe direction is the only real hazard, and the engine's
refusal checks cannot catch every case — that is precisely why the opt-in is a human
assertion.

**There is also a size ceiling, and it is easy to forget.** A single response larger than
`maxBytes * MAX_ITEM_FRACTION` — 25 MB of the default 250 MB budget, and `maxBytes` is
itself clamped to 20% of the browser's quota estimate — is refused outright
(`refusedTooLarge`), no matter how eligible it is. The size proxy is
`JSON.stringify(value).length`, which over-estimates numeric payloads but is close to
exact for columns of long strings. So the heaviest responses in the portal, the ones where
a cache hit would be worth the most, are precisely the ones that never get one. This is
worth stating because it inverts the obvious remedy: when a heavy response is not being
persisted, making it _eligible_ is not the fix — making it _smaller_ is, and once it is
small enough to store it is usually also cheap enough not to need storing. Row subsetting
(`indices` on the dimension-data endpoint) is the tool for that.

### 2a. The group whitelist — the one exception to "public only"

`CACHEABLE_GROUP_NAMES` in `cacheableGroups.ts` names access groups whose datasets may
be written despite being private. It feeds `cacheableUuids`, which is what the address
and dep checks in `buildPersistentKey` test; `publicUuids` remains public-only.

- **Why a group and not a dataset list.** A dataset UUID changes with every version and
  differs per environment, so a UUID list needs maintenance every time data is revised
  and in every deployment. A group is stable across both. `Group.name` is `unique=True`
  in Breadbox and means the same thing in dev, staging and prod, while the id does not —
  hence matching by name. Every dataset from `getDatasets()` already carries
  `group: {id, name}`, so this costs no extra request.
- **Why a group and not `data_type`.** An earlier proposal exempted private
  `data_type: "metadata"` datasets. It was rejected because `data_type` is uploader-set
  free text, not an access-control concept, so the carve-out would silently catch future
  private uploads nobody reviewed. A group has an owner, a membership, and a purpose:
  asserting something about its contents is a claim someone is positioned to make.
- **What the assertion costs.** It is a standing exemption, not a per-artifact decision:
  anyone with write access to a listed group can add a dataset later and it becomes
  cacheable with no review. That is the residual risk, and it is bounded by who can
  write to the group rather than by anything in this code. The case it was built for is
  pre-release data pending review — private only until published, so the disclosure
  window closes on something that was going to happen anyway. A group holding genuinely
  sensitive data does not belong on the list.
- **Removal requires a `CACHE_VERSION` bump in the same commit.** Removing a name stops
  new writes but evicts nothing; there is no per-entry invalidation by design, so bytes
  written under an old whitelist stay readable until the epoch rotates. Same rule as any
  other cache-correctness change.
- **Do not fold the whitelist into `publicUuids`.** That set also builds
  `publicCatalogFingerprint` and encodes what the server means by `scope=public`.
  Merging them would fingerprint a response the server never sent, rotating the coverage
  key on changes that cannot affect it and splitting byte-identical responses across
  users with different access to the whitelisted group.

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
