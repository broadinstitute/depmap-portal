# ADR 0001 — Schema versioning for `DataExplorerPlotConfig`

- **Status:** Accepted
- **Applies to:** `@depmap/data-explorer-2` — plot config (de)serialization
- **Key symbols:** `CURRENT_PLOT_VERSION`, `readPlotFromQueryString`,
  `plotToQueryString`, `normalizePlot`, `parseShorthandParams`,
  `replaceLegacyPropertyNames`, `makePlotConfigBreadboxModeCompatible`

---

## Context

A `DataExplorerPlotConfig` is a **wire format**, not just an in-memory object. Hyperlinks
encode the entire config (compressed, base64'd, in the `p` query param), so every payload
we have ever minted is still out there in bookmarks, Slack threads, and papers. We must
be able to read a config written years ago.

Data Explorer survived for years **without** any version field, by retroactively making
old defaults make sense in an extended world. That strategy works — but **only while
absence is stable**. A missing field has always meant one time-invariant thing, so a
missing field could always be reconciled after the fact.

The `color_by` default flip breaks that precondition. It gives `color_by` a `"group"`
value that becomes the new default, meaning "color follows `group_by`", and removes the
old "if no `group_by`, fall back to grouping by color" fallback. This is the **first
change that makes absence ambiguous**: after the flip, an absent `color_by` must resolve
to `"group"`, but every payload minted before it meant *uniform*. The two cannot be
reconciled retroactively, because the change **inverts** the default rather than
extending it.

Timing is not cost-neutral. If the version field ships *after* the flip, we manufacture a
third cohort — unversioned-but-new-regime — that is shape-indistinguishable from
genuinely-old payloads and must migrate in the *opposite* direction. Stamp with or before
the flip and every unversioned payload is uniformly legacy.

## Decision

Add an explicit `version` field to the serialized payload, and restructure the read path
so migrations are keyed on that version rather than sniffed from payload shape.

### 1. The four concerns in the read path are distinct, and separate by discriminator

The read path used to interleave several migration axes in one flat sequence, which was
the real source of confusion. They are not the same kind of thing:

| Concern | Write twin? | Gated on version? |
|---|---|---|
| **Serialization machinery** (compress/decompress, context hash/unhash) | **Yes** — symmetric | Never. Permanent. |
| **Plot-schema migration** | No | **Yes.** The only axis `version` gates. |
| **Context vintage (V1→V2)** | No | Never. Independent axis (see §5). |
| **Environment-adaptation** (dataset-ID translation, `"custom"` sentinel, `slice_id`→`SliceQuery`) | No | **Never.** Unconditional forever (see §4). |

Read order: `decompress` → read `version` → **Phase A** → **Phase B** →
`replaceHashesWithContexts` → `makePlotConfigBreadboxModeCompatible`.

Version is read *before* context rehydration — it is a plot-level field available on the
decompressed-but-still-hashed payload, and no migration needs expanded contexts.

### 2. Two phases, one bright line

The line is **"the schema the day versioning shipped."**

- **Phase A — frozen, version-gated (`< 1`).** Pre-v1 structural repairs: the
  array→object `dimensions` transform and `replaceLegacyPropertyNames`. These are
  **shape-detected by necessity** — the payloads predate version numbers, so shape is the
  only signal available. The clarifying property: this is a **closed set that only shrinks**
  as old links rot. No future change ever adds a sniffer here.

- **Phase B — version-keyed.** `v0 → v1 → …`, ordered. All future schema migrations live
  here.

This resolves the apparent paradox that *old* renames live in Phase A while *new* renames
would live in Phase B: old renames **define what v0 is**; new renames **define a
transition**. Same operation, opposite sides of the line.

**Do not build a runner framework.** One transition is a single `if (payloadVersion < N)`
branch. The ordered shape exists so the next step slots in, not to be infrastructure.

### 3. `version` is a wire-format field, never an in-memory field

In-memory plots are **always current-schema**. The reader strips `version` on the way in;
`plotToQueryString` re-stamps `CURRENT_PLOT_VERSION` on the way out. Two touch points,
no others.

If any render or selection code ever branches on `version`, that is a bug: it means schema
vintage leaked past the boundary. (Mechanically, leaving it in memory also makes
`plotsAreEquivalentWhenSerialized` see spurious diffs between a loaded plot and an
otherwise-identical in-memory one.)

### 4. Every mint point stamps — so absent means pre-versioning

**Invariant: every code path that mints a plot config stamps `CURRENT_PLOT_VERSION`.**
Today that is `plotToQueryString` (the `p` param) and `parseShorthandParams` (the
human-readable shorthand params). If a third mint point is ever added, it stamps too.

This is what makes **absent version ⟹ pre-versioning legacy** a *true* statement, and
therefore what makes the reader's `?? 0` coercion sound rather than a guess. The
alternative — leaving some producers unstamped — would mean a link minted one second from
now is indistinguishable from a years-old bookmark, and the first Phase B migration would
silently reinterpret it under semantics it was never minted under. **Stamp at the mint
point; never sniff payload shape at the reader.**

Corollary: **`version` certifies SCHEMA vintage, never backend-nativity.** A payload can be
honestly current-schema and still carry backend-legacy forms. `parseShorthandParams` is the
proof — it matches legacy dataset IDs via `legacyPortalIdToBreadboxGivenId` but
deliberately writes the **raw** id, deferring the rewrite downstream; it also emits
`context_type` contexts, the `"custom"` `slice_type` sentinel, and `slice_id` metadata. A
hand-written or LLM-generated URL can do the same.

Therefore **environment-adaptation is unconditional, forever.** It is load-bearing for
those inputs, not an idempotent no-op, and must never be gated on version. (It is
*additionally* idempotent on already-native payloads, which is what makes "always run"
cheap.) Note also that `makePlotConfigBreadboxModeCompatible` has a **second caller**,
`StartScreenExample.tsx`, which passes a hardcoded plot that never went through
hash-expansion and carries no version — gating there would dispatch a non-native plot.

### 5. Context vintage is an independent axis

Contexts are **independently persisted** and dereferenced at read time, carrying their
**own** vintage. A current-schema plot can hold a hash resolving to a V1 context minted
years earlier. You cannot stamp a dereferenced context with the plot's version.

Conversion therefore stays at **point-of-dereference** (`isV2Context` /
`convertContextV1toV2` inside the hash-expansion loop), keyed on the context's shape, not
the plot's version.

**Do not confuse this with `StoredContexts.version`.** That is a separate field on a
separate type, and it uses the **opposite** absent-default (absent ⟹ `1`; the plot
config's is absent ⟹ `0`). The two axes never gate each other.

### 6. Phase B gates on the coerced local, never the raw field

```ts
const payloadVersion = plot?.version ?? 0;   // capture BEFORE the strip
...
if (payloadVersion < N) { /* migration */ }
```

Never `plot.version`. The pre-versioning cohort has **no** `version` field, and
`undefined < N` evaluates to `false` — which would silently skip exactly the payloads a
migration exists to upgrade, while appearing to work correctly on everything newer. The
`?? 0` coercion is the only thing that makes `0 < N === true` for that cohort. This failure
mode is independent of where the strip happens; do not "fix" it by moving the strip.

### 7. A version bump moves as a unit

Bumping `CURRENT_PLOT_VERSION` **simultaneously re-certifies every mint point** as
conformant to the new schema — without touching a line of those producers. So a bump is
never a one-line change. In the **same commit**:

1. Bump the constant.
2. Add the Phase B migration step for the new transition.
3. **Audit every mint point** to confirm it actually emits the new schema.

The number and the schema semantics must move together, or the reader will certify
payloads it has not actually migrated.

**Worked example — why step 3 is not a formality.** `parseShorthandParams` infers
`color_by` and returns `null` (i.e. writes nothing) when there is nothing to color by:

```ts
const inferColorBy = (partialPlot) => {
  if (partialPlot.filters?.color1 || partialPlot.filters?.color2) return "aggregated_slice";
  if (partialPlot.metadata) return "property";
  return null;   // <-- absent color_by
};
```

Under v1 that absence means **uniform**. The moment `CURRENT_PLOT_VERSION` becomes `2`,
that same untouched line is *declared* to mean **group** — a semantic change to a live
producer, caused by editing a constant in a different file. Nothing breaks loudly. The
audit is the only thing standing between a version bump and a mint point quietly emitting
payloads whose meaning it never intended.

### 8. Migrations write the old *effective* value; they never adopt the new default

A migrated payload gets **its resolved past**, written explicitly. New plots get the new
default from `DEFAULT_EMPTY_PLOT` / the creation path. A migration that "helpfully"
upgrades an old plot into the new default silently changes what an existing link renders.

## Consequences

- Absent `version` is now a **meaningful, load-bearing signal**, and stays meaningful only
  as long as §4 holds. A new unstamped mint point is a latent data-corruption bug, not an
  oversight.
- Phase A can only ever shrink. If someone proposes adding a shape sniffer to it, the
  proposal is in the wrong phase.
- We accept a permanently unconditional environment-adaptation pass — the version field
  buys nothing there, by design.
- Version **1** is the post-mechanism, **pre-flip** schema: absent `color_by` still means
  uniform. The `color_by` default flip ships as version **2**, filling the Phase B slot
  with its materialization migration.

## Related

- Commit introducing this: "Add schema versioning to DataExplorerPlotConfig (version 1)".
- **ADR 0002 — `normalizePlot` is an allowlist normalizer.** The `sort_by` fix in this
  commit is an instance of that hazard class, and the incoming `color_by: "group"` is a
  latent one. Read 0002 before adding any field to `DataExplorerPlotConfig`.
- The `color_by` default flip (version 2) is not yet decided and has no ADR. Its open
  design inputs — the `ColorByValue` type split, the `group: null` degenerate, the
  `findCategoricalSlice("expansion")` throw, the categorical 1D-fidelity branch, and the
  `group_by: "expansion"` lifecycle — are tracked in the v2 gotchas handoff, not here. An
  ADR records a decision that was *made*; those are inputs to one that has not been.
