# ADR 0004 — `color_by` default flip: `"facet"` and the `"uniform"` sentinel

- **Status:** Accepted
- **Applies to:** `@depmap/data-explorer-2` — `ColorByValue`, `normalizePlot`,
  `readPlotFromQueryString`, `resolveColorMode` and its call sites in
  `plotUtils.ts`/`use*PlotData.ts`, Transcript Explorer's `TranscriptColorByTypeSelect`
- **Key symbols:** `resolveColorMode`, `CURRENT_PLOT_VERSION` (now `2`), `ColorByValue`
- **Read this before:** changing what an absent `color_by` or `facet_by` means, or adding
  a new `ColorByValue` member

---

## Context

ADR 0001 pre-announced this change — "the `color_by` default flip (version 2)" — and
deliberately deferred it, listing five open design inputs it left unresolved. This
record makes the decision ADR 0001 declined to make, and closes each of those inputs.

Once `facet_by` became a fully independent axis (its own `filters.facet1`/`facet2`,
`metadata.facet_property`, `dimensions.facet`, and `"expansion"` support — see the
commits preceding this one), a gap opened up: picking a `facet_by` with no `color_by`
produced an uncolored plot, even though the natural expectation is that faceted points
get *some* visual distinction. Requiring users to separately configure `color_by` to
match whatever they just told `facet_by` to do is duplicate work for the common case.

The fix is to make an absent `color_by` mean **"match `facet_by`"** by default. But
absence is not free to redefine — ADR 0001 exists precisely because absence had, until
now, been a stable, time-invariant signal. Under version 1, an absent `color_by` meant
"uniform, no coloring." Flipping that default without versioning would silently
recolor every historical link the moment it loads. This is the exact hazard ADR 0001's
whole mechanism was built to contain, and the reason this change is gated behind
`CURRENT_PLOT_VERSION` bumping from `1` to `2`.

## Decision

### `ColorByValue` gains two members: `"facet"` and `"uniform"`

- **`"facet"`** — defers coloring entirely to `facet_by`'s own resolution: same
  categorical/continuous/custom-filter/expansion source, same partition, same colors
  `facet_by` is already computing. It is also the new **implicit default** — an absent
  `color_by` is read as `"facet"` (see `resolveColorMode` below).
- **`"uniform"`** — explicit "no color, regardless of `facet_by`" sentinel. This is the
  value a version-1 payload's absent `color_by` migrates to, and the only way (short of
  `"custom"`/`"property"`/etc. with real backing) to opt back out of the new default.

Both values are meaningless for `facet_by` itself — `facet_by` continues to reuse the
`ColorByValue` union (no type split; see "Resolved open inputs" below) purely by
convention, the same over-permissive convention the type already had before this change.

### `resolveColorMode` is the one place that reads `color_by` raw

```ts
export function resolveColorMode(
  plotConfig: Pick<DataExplorerPlotConfig, "color_by" | "facet_by">
): { mode: ColorByValue | undefined; target: "color" | "facet" } {
  const effective = plotConfig.color_by ?? "facet";

  if (effective === "uniform") {
    return { mode: undefined, target: "color" };
  }
  if (effective === "facet") {
    return { mode: plotConfig.facet_by, target: "facet" };
  }
  return { mode: effective, target: "color" };
}
```

Every renderer/hook call site that used to read `plotConfig.color_by` directly
(`getColorMap`, `calcVisibility`, `getLegendKeysWithNoData`, `formatDataForScatterPlot`,
`formatDataForWaterfall`, `calcDensityStats`, `useLegendState`, and the three
`use*PlotData.ts` hooks) now resolves through this function first, and reads
`{mode, target}` — never raw `color_by` — for every filter/dimension/metadata lookup
(`filters.[target]1/2`, `dimensions[target]`, `metadata.[target]_property`).

This function must only ever run against an **already-migrated, in-memory** plot
config — never a raw wire payload (see the version bump below for why).

### `CURRENT_PLOT_VERSION`: `1` → `2`, with a Phase B migration

Per ADR 0001 §7, the bump moves as a unit with:

1. **The Phase B migration** in `readPlotFromQueryString`, unconditional on `facet_by`'s
   presence: `if (payloadVersion < 2 && plot && !plot.color_by) { plot.color_by =
   "uniform"; }`. A v1 payload's absent `color_by` never deferred to `facet_by` — even
   if that payload happens to also have a `facet_by` set — so it must materialize as
   `"uniform"` explicitly, per ADR 0001 §8 ("migrations write the old effective value").
2. **A mint-point audit.** `inferColorBy` (the shorthand-link mint point in
   `query-string-parser.ts`) used to `return null` for "nothing to color by," which was
   correct under v1 (absence meant uniform) but would silently become "facet" under v2.
   Fixed to `return "uniform"` in the same commit as the bump — shorthand links have no
   way to set `facet_by`, so an absent `color_by` from this function is always
   genuinely-uniform, never "match a nonexistent `facet_by`."

### `normalizePlot`: strip `"facet"`, preserve `"uniform"` unconditionally

Per ADR 0002, both values need an explicit, commented decision, not a silent
non-change:

- `"facet"` has no backing of its own, and post-v2 absence already reads back as
  `"facet"` — so it is stripped (not re-added) as a no-op-on-meaning byte-saving
  measure.
- `"uniform"` is **not** equivalent to absence post-v2 (absence now means `"facet"`),
  so it is preserved unconditionally — it has nothing to validate, being complete by
  construction.
- The three existing backing arms (`filters.color1/2`, `metadata.color_property`,
  `dimensions.color`) were tightened to exclude both new values, so stale leftover
  color backing can never re-stamp a `"facet"`/`"uniform"` `color_by` alongside data a
  reader would wrongly associate with it.

### Transcript Explorer UI

> **Note (see ADR 0005):** the components named throughout this section
> (`TranscriptColorByTypeSelect`, `TranscriptColorByViewOptions`,
> `TranscriptGroupByTypeSelect`) were later deleted outright — once DE2 main gained its
> own `facet_by` UI (the "separate follow-up" mentioned at the end of this section),
> Transcript Explorer's parallel fork was retired in favor of the exact same shared
> components DE2 main uses. The design principles below (non-clearable selector, no
> explicit "Uniform" option, load-time coercion of a stray `"uniform"`) carry forward
> unchanged into those shared components; only the specific file names are stale. See
> ADR 0005 for the current shape.

`TranscriptColorByTypeSelect` gains one new option, "Match Facet By" (`"facet"`), and
is **not clearable** — it never offers an empty/"Uniform" state at all.

This was not the first design tried. The first pass gave the select `isClearable` plus
an explicit "Uniform" option, on the theory that clearing needed somewhere to land now
that absence means "facet" instead of "no color." That was backwards, caught before it
shipped: DE2's own sibling selector, `ColorByTypeSelector` (in
`.../DataExplorerPage/components/ConfigurationPanel/selectors.tsx`), was already never
clearable and never had `facet`/`uniform` options — `TranscriptColorByTypeSelect`'s
`isClearable` was an unintentional divergence from that pattern, not a considered
choice, and it's what manufactured the "what does an empty color-by mean" question in
the first place. Once the field can't be emptied, that question doesn't need an
answer: the only states are "match facet" (this option, and the default), or an
explicit divergence (the other options, unchanged). `TranscriptGroupByTypeSelect`
stays clearable — "facet by nothing" is one of those real states, reached by clearing
`facet_by`, not `color_by`.

`"uniform"` can still arrive at this component from outside it — an old pre-v2
bookmark migrated on read, or a hand-authored/Delphi link setting `color_by: "uniform"`
directly. Two things handle that:
- **Display**: `TranscriptColorByViewOptions` passes `color_by && color_by !== "uniform"
  ? color_by : "facet"` as the select's value, so a stray `"uniform"` displays as
  "Match Facet By" immediately, without waiting on a dispatch to land.
- **State**: a `useEffect` in the same component watches `plot.color_by` and dispatches
  `select_color_by` with `undefined` the moment it sees `"uniform"`, actively clearing
  it from the plot object. This is required, not cosmetic — `normalizePlot` preserves
  `"uniform"` unconditionally (by design, for consumers other than this one), so
  without an active clear it would silently persist across every
  serialize/deserialize round-trip for a session that happened to load it once.

The `"uniform"` value itself, `normalizePlot`'s preserving arm, and the v1→v2
migration are untouched by any of this — they remain correct for any other consumer of
a `DataExplorerPlotConfig`. This is a UI-scoping decision for one widget, not a
system-wide removal: `"uniform"` is still a fully valid, fully supported wire value: it
is simply not reachable through Transcript Explorer's color-by selector, and Transcript
Explorer actively normalizes it away if it ever shows up there anyway.

**Accepted trade-off.** "Facet by X, but leave points explicitly uncolored" is no
longer reachable through this UI (only via a hand-authored/Delphi link, which
Transcript Explorer will then immediately coerce away next time its config panel loads
that plot). This was a deliberate simplification, weighed against the confusion of
`"uniform"` needing to exist as a live, discoverable choice at all — not an oversight.

DE2's own `ConfigurationPanel` is out of scope for this change — it has no independent
`facet_by` control yet and its `color_by` selector predates the color/facet split. That
is a separate follow-up. **(Done — see ADR 0005.)**

## Resolved open inputs (from ADR 0001)

ADR 0001 named five open design inputs. Here is where each lands:

1. **The `ColorByValue` type split** (should `color_by` and `facet_by` be different
   types, since `"facet"`/`"uniform"` are meaningless for `facet_by`?) — **deferred**,
   deliberately. `facet_by` already over-permits values by convention rather than by
   the type system (nothing stopped `facet_by: "expansion"` from being type-checked
   against the same union before this change either). A real split is additive and
   low-risk to add later; forcing it into this already-large change buys type safety
   `facet_by`'s existing conventions don't yet rely on.

2. **The `facet: null` degenerate** (what happens when `color_by` resolves to `"facet"`
   but `facet_by` itself has no backing?) — **resolved by construction**, not by a new
   branch. `resolveColorMode` returns `{ mode: plotConfig.facet_by, target: "facet" }`
   unconditionally; when `facet_by` is unset, `mode` is `undefined`, and every
   target-aware helper's existing "no match found" fallthrough already treats an
   undefined mode as uniform — the exact path that already ran whenever `facet_by` was
   literally unset for facet-side computations, before this change existed. No new
   degenerate-case branch was needed anywhere, provided every call site resolves
   through this function (which the sweep in this change ensures).

3. **The `findCategoricalSlice("expansion")` throw** (it throws when `data.expansions`
   is missing, by design, assuming the caller only reaches this branch when expansion
   data is genuinely present) — **not resolved here; accepted as a widened risk.**
   Before this change, this branch was reachable only via a direct
   `facet_by === "expansion"` read. After this change, it is also reachable via *any*
   path that resolves `color_by`, since `resolveColorMode` can hand back
   `mode: "expansion"` whenever `facet_by === "expansion"` and `color_by` is
   absent/`"facet"`. This widening is a consequence of this change, not caused by a bug
   in it, and is being deliberately left as a follow-up rather than scoped into an
   already-large change.

4. **The `facet_by: "expansion"` lifecycle** (does entering/exiting Transcript
   Explorer's expansion mode need new handling?) — **unaffected.** The existing
   one-time-default-on-entry / clear-on-exit handling in `plotConfigReducer.ts` already
   operates purely on `facet_by` and needs no change; this feature only changes what an
   *absent* `color_by` resolves to, not how `facet_by: "expansion"` itself behaves.

5. **The "categorical 1D-fidelity branch"** — **could not be located in code.** This
   phrase from ADR 0001 was searched for across `plotUtils.ts` and the three
   `use*PlotData.ts` hooks during this change's implementation and no matching branch
   or comment was found. This is flagged explicitly rather than silently dropped: if
   this refers to something real, it needs to be identified and revisited; if it was a
   miscommunication or a branch that no longer exists, ADR 0001's mention of it should
   be corrected.

## Consequences

- **Picking a `facet_by` now colors points automatically**, with no separate
  `color_by` selection — the primary motivation for this change.
- **Every pre-version-2 bookmarked link keeps rendering exactly as before.** A v1
  payload's absent `color_by` migrates to explicit `"uniform"` on read, per ADR 0001
  §8.
- **`"uniform"` is now load-bearing, not cosmetic.** Any code path that strips it
  (rather than preserving it verbatim through `normalizePlot`) silently reintroduces
  the new default for a plot whose author explicitly opted out.
- **The `findCategoricalSlice("expansion")` throw's blast radius has widened** (see
  input 3 above) and is accepted as an out-of-scope follow-up.
- **A real `ColorByValue`/`FacetByValue` type split remains undone** (input 1 above);
  the type continues to over-permit values that are meaningless for `facet_by`.

## Related

- **ADR 0001** — establishes the versioning mechanism this change depends on, and is
  the source of the five open inputs resolved above.
- **ADR 0002** — the `normalizePlot` allowlist discipline this change's `"facet"`/
  `"uniform"` arms follow.
- **ADR 0003** — `generating-de2-links.md` was updated to version 2 in the same
  change, per the lockstep rule this ADR establishes.
- **ADR 0005** — closes out this ADR's "separate follow-up" (DE2 main's own `facet_by`
  UI, which also retired Transcript Explorer's parallel fork entirely), and records the
  further consequences of `facet_by` being a fully independent axis: the swap button,
  the "Facets" panel for when `color_by`/`facet_by` diverge, the neutral-fill fallback,
  and the regression line/table fallback to `color_by` when `facet_by` is unset.
