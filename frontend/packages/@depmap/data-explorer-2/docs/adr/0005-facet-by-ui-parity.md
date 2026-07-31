# ADR 0005 — `facet_by` reaches full UI parity with `color_by`

- **Status:** Accepted
- **Applies to:** `@depmap/data-explorer-2` — `ConfigurationPanel/{ViewOptions,FacetByViewOptions,
  ColorByViewOptions,selectors}.tsx`, `utils.ts` (`canSwapColorAndFacet`), `reducers/plotConfigReducer.ts`
  (`swap_color_and_facet`), `components/plot/PlotFacets.tsx`, `components/plot/prototype/plotUtils.ts`
  (`useLegendState`'s `targetOverride`, `computeFacets`/`computeFacetedLinReg`'s `target`,
  `NEUTRAL_FACET_FILL`), the three `use*PlotData.ts` hooks and their container components,
  `SmallMultiplesScatter.tsx`, Transcript Explorer's `TranscriptConfigPanel`
- **Key symbols:** `canSwapColorAndFacet`, `swap_color_and_facet`, `colorMatchesFacet`, `PlotFacets`,
  `useLegendState(plotConfig, legendKeysWithNoData?, targetOverride?)`, `computeFacets`/
  `computeFacetedLinReg`'s `target` parameter, `NEUTRAL_FACET_FILL`
- **Read this before:** changing the swap button's completeness/no-op logic, changing when the
  "Facets" panel shows or how a facet toggle removes a panel, or changing when the regression
  line/table splits by `color_by` instead of `facet_by`

---

## Context

ADR 0004 made `facet_by` color-matching the default and gave Transcript Explorer its own
`facet_by` UI, but explicitly deferred a list of consequences as "separate follow-ups" — most
notably, DE2 main's own `ConfigurationPanel` had no `facet_by` control at all. Once that
follow-up was actually implemented, a further set of gaps surfaced, each a direct consequence of
`facet_by` being a **fully independent axis** rather than a `color_by` alias: what happens when
the two diverge, what happens when only one of them has a real selection, and what a
one-click "swap what's on each axis" affordance should mean given the two are *not* perfectly
symmetric (`color_by` has two sentinel values, `"facet"`/`"uniform"`, that `facet_by` doesn't).
This ADR records how each of those unfolded.

## Decision

### 1. DE2 main gets `facet_by` too; Transcript Explorer's parallel fork retires entirely

`FacetByViewOptions.tsx` (mirroring `ColorByViewOptions.tsx`'s shape) and a swap button were
added to DE2 main's `ConfigurationPanel/ViewOptions.tsx`, gated together behind the same
`plot.plot_type !== "correlation_heatmap"` guard that already hid `ColorByViewOptions` alone for
that plot type — `facet_by`, the swap button, and `color_by` now appear or disappear as one unit.

Because the shared components already covered every mode Transcript Explorer's own fork needed
(once `"expansion"` awareness and a generalized `MaxToShowSelect` were folded into the shared
`selectors.tsx`/`ViewOptions.tsx`), Transcript Explorer's parallel fork —
`TranscriptConfigPanel/TranscriptViewOptions/` and its `TranscriptGroupByTypeSelect`/
`TranscriptColorByTypeSelect`/`TranscriptColorByViewOptions`/`TranscriptGroupByViewOptions`/
`TranscriptMaxToShowSelect` components (all named in ADR 0004's "Transcript Explorer UI"
section) — was deleted outright, not merely left in place alongside the new shared one.
`TranscriptConfigPanel/index.tsx` now imports and renders the exact same `ViewOptions` component
DE2 main does. There is no longer a Transcript-specific color/facet selector anywhere in the
codebase; the design principles ADR 0004 recorded for that fork (non-clearable selector, no
explicit "Uniform" option, load-time coercion of a stray `"uniform"`) now live in, and apply to,
the one shared implementation.

**Consequence:** any future change to color/facet selection UI is made once, in the shared
components, and is automatically correct for both surfaces. There is no second copy to
remember to update.

### 2. The swap button — three cases, not one

`color_by` and `facet_by` are backed by a symmetric set of fields (`filters.color1/2` ↔
`facet1/2`, `metadata.color_property` ↔ `facet_property`, `dimensions.color` ↔ `facet`, the same
five shared mode values), so a one-click "trade what's on each axis" affordance is cheap to
offer and saves re-picking an identical selection on the other axis. `canSwapColorAndFacet`
(`utils.ts`) is the single source of truth for both the button's visibility and the reducer's
own no-op guard (`swap_color_and_facet` calls the identical function), so the two can never
disagree about when a swap is meaningful.

It resolves to `true` in exactly three, mutually-exclusive cases:

- **Standard** — both axes already hold one of the five real, shared values, both are
  *complete* (have real backing, not just a mode picked from a dropdown mid-selection), and
  they don't already resolve to the identical source (`axesAlreadyMatch`) — a full two-way
  exchange of mode + filters/metadata/dimensions.
- **Promote** — `facet_by` is unset and `color_by` holds a real, complete value: move it over to
  become `facet_by`; `color_by` becomes `"facet"` (defers back to it).
- **Demote** — `facet_by` holds a real, complete value, and `color_by` does **not** hold an
  equally complete, independent selection of its own. This covers three sub-cases uniformly:
  `color_by === "facet"` (explicitly deferred), an **absent** `color_by` (deliberately treated
  identically to `"facet"` — `resolveColorMode` already conflates the two when *reading* the
  plot, so the button's own completeness check must too, or the button would work for one and
  not the other of what is, semantically, the exact same state), or a real mode value that's
  still mid-selection (e.g. `"property"` picked from the dropdown but no annotation chosen
  yet — an interrupted selection with nothing worth preserving). `facet_by`'s mode and backing
  move over to become `color_by`; `facet_by` is cleared entirely.

**Deliberately excluded from demote:** `color_by: "uniform"`. Unlike an absent `color_by` or a
mid-selection real mode, `"uniform"` is a **complete, deliberate** choice (explicit no-color),
not a deferred or interrupted one — so it stays a no-op, and remains the one state the swap
button can never produce or consume for you. You have to set it yourself.

### 3. The "Facets" panel — shown only when `color_by`/`facet_by` diverge

Normally the Legend panel doubles as the facet key, because `color_by` defers to `facet_by`
(explicitly or by default). But once `color_by` is set to something of its own **and**
`facet_by` is independently set to something real, facet membership becomes invisible — the
Legend now shows an unrelated color partition, with no way to tell which points belong to which
facet.

Fix: a second panel, "Facets" (`components/plot/PlotFacets.tsx`), shown only in that diverged
case — gated by `!colorMatchesFacet && <the plot type's own "facet_by has real backing" signal>`
in each of the three container components. `colorMatchesFacet` is the gate, not
`resolveColorMode(...).target === "color"` alone: the two differ whenever `color_by` and
`facet_by` are both explicitly set to the identical underlying source (not via the `"facet"`
sentinel, just a genuine coincidence) — showing the panel in that case would be a redundant
readout of the Legend, which already shows the same partition.

`PlotFacets` offers the identical interaction Legend does (click to toggle, double-click to
isolate, show/hide all), backed by a **second, independent** `useLegendState` instance pinned to
`"facet"` via a new optional `targetOverride` parameter (`useLegendState(plotConfig,
legendKeysWithNoData?, targetOverride?)`) — every existing call site is unaffected, since
omitting the third argument preserves today's exact behavior (deferring to
`resolveColorMode(plotConfig).target`). Each row has **no color swatch** — a fixed neutral
square (`NEUTRAL_FACET_FILL`, see below) instead, since there is no color mapping to represent;
the row is a plain list entry, not a per-facet color assignment.

### 4. Toggling a facet fully removes its panel — in both the diverged and converged case

When `facet_by` is independent (the Facets panel is visible), toggling an entry there fully
removes that facet's small-multiples panel from the scatter grid, rather than graying it out —
a deliberate user action now has a visible, causal effect, unlike the pre-existing (and
unrelated) "every point in this facet happens to be filtered out" placeholder, which still
grays out and stays in the grid.

When `color_by` and `facet_by` have **converged** (no Facets panel — Legend doubles as the facet
key), toggling a Legend entry needs to behave identically, because it *is* toggling that facet.
This required a translation step: `hiddenLegendValues` (the Legend's hidden set) lives in raw
`LegendKey` space — a real category string, or one of the shared symbols
(`LEGEND_OTHER`/`LEGEND_BOTH`/`LEGEND_RANGE_N`) used for the "Other"/"Both"/continuous-bin
cases — while `SmallMultiplesScatter`'s `hiddenFacets` prop operates in `facetKeys`' **plain
string** space (`computeFacets` always stringifies for `facetMaskFor`'s sake). The bridge is
`computeFacets`'s own `facetColorKeys` reverse-lookup table (`Record<string, LegendKey>`) — the
same one `regressionLinesByFacet`'s color lookup already relies on — used here in reverse: for
each facet string, look up its real `LegendKey` and check whether the Legend has hidden it.

The pre-existing "(hidden)" placeholder-over-an-empty-panel annotation is retained, but its
scope narrows to exactly the case it was never meant to replace: a facet whose points become
invisible for reasons **other than a direct toggle** (e.g. an unrelated `filters.visible`
context happens to exclude every point belonging to one facet). It is no longer how a direct
facet toggle is represented, in either the converged or diverged case — a direct toggle now
always removes the panel outright.

### 5. Neutral (gray) fill when `facet_by` has real backing but `color_by` doesn't

`palette.all`/`LEGEND_ALL` is shared between two very different situations that both hit the
same "no color enabled" fallthrough: a totally vanilla plot (neither axis set) and a plot where
`facet_by` is doing real work but `color_by` isn't (absent/`"uniform"`). Changing `palette.all`
itself to a neutral gray would fix the second case but silently gray out the first, vanilla one
too — not wanted.

Fix: a dedicated, hardcoded constant, `NEUTRAL_FACET_FILL` (`#bdbdbd`, exported from
`plotUtils.ts`), applied only where the calling component/hook can independently determine
`facet_by` has real backing — density/small-multiples' solid-color fallback
(`hasRealFacetBacking`) and a `hasFacetOptionsEnabled` prop threaded into
`PrototypeScatterPlot`/waterfall's `templateTrace`. Hardcoded rather than `palette.other`, so it
stays inert regardless of palette customization — this mirrors an existing precedent already in
the codebase for the same reason (the violin-fill "inert" treatment this decision was modeled
on).

### 6. Regression line/table falls back to `color_by` when `facet_by` is unset

The classic per-color-category regression split (`fetchLinearRegression`, the non-expansion
path) has always existed for `color_by` alone and needed no change here. The gap was narrower:
once a plot has been expanded (`expand_by`, where `fetchLinearRegression` doesn't apply) **and**
`facet_by` is unset, the existing fallback drew a single pooled line, ignoring `color_by`
entirely — even when `color_by` was a categorical or custom-filter split that "should" have
produced one line per category, matching what the same plot would show unexpanded.

Fix: `computeFacets` and `computeFacetedLinReg` (both already shared, `facet_by`-shaped helpers)
gained an explicit `target: "color" | "facet" = "facet"` parameter — every existing call site is
unaffected by the default. `useScatterPlotData.ts`'s `regressionLines` and the regression table
(`ConfigurationPanel/LinearRegressionInfo/index.tsx`) both now try
`computeFacetedLinReg(data, colorMode.mode, visible, "color")` first whenever `facet_by` is
unset, falling back to `computePooledLinReg` only when that produces no rows. A **continuous**
`color_by` deliberately still pools into one line — matching `fetchLinearRegression`'s own
behavior, which never splits on a continuous color either; only categorical/custom-filter
`color_by` gains the new per-category lines.

## Consequences

- `facet_by` is now a complete, independent axis with full UI parity to `color_by` everywhere
  DE2 renders a plot. Transcript Explorer and DE2 main share one implementation, not two, for
  every part of this: the selectors, the swap button, the Facets panel, and the rendering
  fallbacks.
- The swap button, the Facets panel, and the neutral-fill/regression fallbacks all key off the
  same two primitives — `resolveColorMode`/`colorMatchesFacet`, and `computeFacets`'s `target`
  parameter — rather than each re-deriving "are these two axes the same" independently. A future
  third consumer of "is color deferring to facet" should use `colorMatchesFacet`, not invent a
  fourth check.
- `"uniform"` remains the one `color_by` state the swap button can never reach *for* you — it is
  still the only way to say "`facet_by` is real, but I explicitly want no color," and that
  choice has to be made deliberately, not arrived at via swap.
- A facet that is empty because every one of its points is independently filtered out (not
  because it was toggled off) is still visually distinguishable from a directly-toggled-off
  facet: the former grays out in place (small multiples) or shows "(hidden)" (the shared
  placeholder), the latter disappears outright.

## Related

- **ADR 0004** — the `color_by` default flip that made this parity work worth doing. This ADR
  closes out its "DE2 main is a separate follow-up" note and its "Transcript Explorer UI"
  section's file references, which are now stale (see the note added there pointing here).
- **ADR 0002** — `computeFacets`/`computeFacetedLinReg`'s `target` parameter and the swap
  reducer's filters/metadata/dimensions destructuring both follow the allowlist/field-survival
  discipline that ADR establishes for `normalizePlot`.
