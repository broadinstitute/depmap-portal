# ADR 0009 — Generalizing the export modal across plot types and formats; CSV export moves to SliceTable

- **Status:** Accepted
- **Applies to:** `ExportImageModal` and the plot-export path for every Data Explorer plot
  type (scatter, small-multiples, density_1d, waterfall, correlation_heatmap); the CSV
  export path for everything except correlation_heatmap.
- **Key symbols:** `PreviewPlotSupport`, `RenderPreviewPlot`, `ExtendedPlotType.getImageFigure`,
  `calcChromeAxisOverrides`, `calcPlotIndicatorLineShapes`, `calcViolinOutlineWidth`,
  `padOuterEdge` / `padOuterEdgeSvg`, `rememberExportConfig` / `readRememberedExportConfig`,
  `showExportCsvModal`, `dimensionToSliceQuery`, `buildTableConfig`, `contextToSliceSelection`

---

## Context

The export modal started out covering scatter and density_1d: dimensions, legend
placement, extra margin, and plot styles, all PNG-only. This round of work took it to
every plot type and added a second export-only axis (line weight) and a second format
(SVG), while separately replacing the CSV download (a hand-rolled, no-preview
`plotToLookupTable` → string → link-click path that predates `SliceTable`) with a
`SliceTable`-in-a-modal experience for the plot types where that's the better fit.

Both threads share one constraint that shaped almost every decision below: **a change
made for one plot type must be invisible to every other one, and a value left at its
default must reproduce today's exact output.** The modal is one component serving five
renderers with materially different capabilities (no legend, no y-axis, no points, a
second panel), so "generalize without regressing anyone who doesn't opt in" is the
recurring shape of the problem.

## Decision

### 1. Capability flags, not per-plot-type branching, in the modal

`PreviewPlotSupport` (`ExportImageModal/index.tsx`) grew from just `render` +
`pointSizeField` to seven fields: `legend?`, `hasDataLines?`, `hasYAxisLabel?`,
`hasViolinLines?`, `hasPointStyles?`, `hasTickFontSize?`, `hasSecondaryXAxisLabel?`. Every
flag **defaults to whichever value keeps every existing renderer's behavior unchanged**;
only the plot type that needs the opposite sets it explicitly. Concretely:
`hasDataLines`/`hasYAxisLabel`/`hasPointStyles` default `true` (scatter/waterfall need
them), `hasViolinLines`/`hasTickFontSize` default `false` (only density_1d and the
heatmap, respectively, need them), and `hasSecondaryXAxisLabel` is set per-export from
live data (`Boolean(heatmapData?.z2)`), not per-plot-type, since whether the "distinguish"
split exists depends on the current query, not the plot type.

The alternative — a `switch (plotType)` in the modal — was rejected because it makes the
modal's own diff grow with every new plot type, and because "does this plot type have
Y-axis fields" is a fact the wrapper already knows and the modal has no way to check
independently. The modal trusts the flag; nothing here re-derives it from `plot.layout`.

The same flags gate correctness, not just UI: `areStylesValid`'s
`pointOpacity > 0 || outlineWidth > 0` check used to run unconditionally, which would have
permanently blocked the heatmap (no point styles at all) from ever validating. It's now
skipped whenever `hasPointStyles` is false.

### 2. Two new line-weight settings, both export-only, and deliberately not one

"Chrome" (gridlines/axis lines/tick marks) and "data" (y=x + regression lines) are
separate settings — `chromeLineWidth` and `dataLineWidth` — not a single "line width"
knob, because they need different formulas, not just different defaults:

- **Chrome** (`calcChromeAxisOverrides`) is a direct substitution — grid/zeroline width
  is the setting's value — with one deliberate omission: it never sets `showline`,
  `linewidth`, or `linecolor`. An axis border was never part of the on-screen look, and an
  earlier version turned one on as a side effect of leaving the default, which read as an
  unexplained line appearing out of nowhere. `chromeLineWidth === 0` is its own branch
  (`showgrid: false, zeroline: false`), not a `width: 0` value — Plotly can rasterize a
  zero-width stroke as a one-device-pixel hairline instead of nothing, which is exactly
  wrong for a control whose whole point is "hide this."
- **Data** (`calcPlotIndicatorLineShapes`'s new trailing `dataLineWidth` parameter) is a
  halo-plus-main-line pair, so scaling it is two different relationships to the same
  input: the regression halo is `dataLineWidth + 2` (a **constant delta**, so it doesn't
  blow out proportionally at large widths), while the identity line's two dash styles are
  `dataLineWidth / 2` (a **ratio**, preserving identity's existing 2:1 subtlety relative
  to regression at any setting). Both defaults reduce to today's exact literals
  (`width: 4`/`width: 2` for regression, `width: 1` for identity) — this is additive
  capability, not a visual change for anyone who leaves it alone.
- Both are **export-only**: nothing was added to the global Settings modal or
  `Settings["plotStyles"]`. Every complaint motivating this was about legibility at
  export/slide scale, never about the live plot.
- **Colors are fixed constants** (`EXPORT_CHROME_GRID_COLOR`/`EXPORT_CHROME_LINE_COLOR`),
  not user-configurable. Only width was in scope for this pass.

### 3. `calcChromeAxisOverrides`'s real bug, and why the fix is "touch fewer fields"

The first version of chrome-line-width support set `tickwidth`/`tickcolor` directly,
which produced small perpendicular tick marks on every axis that had never drawn them
before, at any non-default width. Root cause, found by reading
`plotly.js/src/plots/cartesian/tick_mark_defaults.js`'s `handleTickMarkDefaults`: the
`ticks` attribute's own default flips from `""` to `"outside"` the instant `tickwidth` or
`tickcolor` is merely _present_ in the input layout, regardless of value. There is no way
to set a grid/zeroline width without tripping this except to also force `ticks: ""`
explicitly — so the fix scales gridlines and the zeroline only, and never sets
`tickwidth`/`tickcolor`/`showline`/`linewidth`/`linecolor` at all, at any setting.

### 4. The y-axis tick-font caching trap in the correlation heatmap

`PrototypeCorrelationHeatmap` caches its y-axis object across relayouts
(`axes.current.yaxis`) so a user's zoom/pan survives a re-render. Adding
`tickFontSize` as `axes.current.yaxis || { ..., tickfont: { size: tickFontSize }, ... }`
looked reasonable but froze the font at whatever it was the one time the fallback literal
actually ran — once the cache is warm (which happens immediately for the export preview,
since `initialAxes` seeds it), every later `tickFontSize` change was silently ignored. The
fix is structural, not a one-off patch: **any field that must track a later prop change
has to sit outside the `cached || freshDefault` fallback**, applied by moving
`tickfont: { size: tickFontSize }` to a spread _after_ the `||` expression rather than
inside it. `xaxis`/`xaxis2` never had this bug — they're rebuilt fresh every render, only
`yaxis` is cached — which is why this surfaced on one axis and not the other three.

### 5. The heatmap's selection-outline `shapes` array: a `null` entry only `toImage` chokes on

Single-heatmap exports showed a large black rectangle covering the whole plot, but only
through the export modal, never on the live screen. The `shapes` array was built as
`[primaryShape, z2Key ? secondaryShape : null]` — a literal `null` sat in the array
whenever there was no second panel. `Plotly.react`'s live rendering silently tolerates a
`null` shape; `Plotly.toImage`'s static rendering path does not — it coerces the `null`
into a shape at Plotly's own defaults (`type: "rect"`, `xref`/`yref: "paper"`, the full
0–1 span, a black border), which is exactly the rectangle that appeared. Fixed with
`.filter(Boolean)` on the array. The general lesson carried forward: **`Plotly.react` and
`Plotly.toImage` do not validate the same layout the same way**, so a value that "just
works" on screen is not evidence it's a well-formed value for export.

### 6. Remembered settings split into a shared bucket and a per-plot-type bucket

`rememberExportConfig`/`readRememberedExportConfig` write to `SHARED_STORAGE_KEY`
(`width`, `height`, `unit`, `resolution`, `format`) and a separate
`` `data_explorer_2_image_export_${plotType}` `` key (`legendPosition`, `edgePadding`,
`chromeLineWidth`, `dataLineWidth`, `violinLineWidth`, `tickFontSize`, and every
`plotStyles` field the modal edits). The split exists because the two buckets answer
different questions: width/height/unit/resolution/format describe the **output target** —
a slide, a print page — which has nothing to do with which plot produced it, while
everything else is tuned against one renderer's own automargin/font/legend behavior and
can look wrong transplanted onto another (a `chromeLineWidth` picked to look right on a
dense heatmap is not the value you'd pick for a sparse scatter). Before this, every
setting lived in one un-namespaced key, so tuning one plot type's appearance silently
overwrote what the next plot type would open to.

Every field, in both buckets, is re-validated against current bounds on read
(`readStoredObject` catches parse failures and returns `null`; each field falls back to
`DEFAULT_EXPORT_CONFIG`'s value if missing, wrong-typed, or out of range) rather than
trusted — a stored payload can be from a version of the app with different fields, or
hand-edited.

### 7. SVG becomes a first-class, selectable format instead of a separate menu item

The old UI had a second "download as SVG" menu entry that called
`plot.downloadImage({ format: "svg" })` directly, bypassing every option the PNG path
already had. The question of whether to keep SVG support at all was raised explicitly —
Plotly's own `toSVG`/`svgToImg` (`plotly.js/src/snapshot/tosvg.js`,
`svgtoimg.js`) bake a fixed `width`/`height`/`viewBox` onto the root `<svg>` at export
time, so the output isn't meaningfully "scalable" in the way SVG usually promises; it's a
vector _encoding_, not a resizable document. That's still worth having (crisp text/lines
at any zoom, editable in Illustrator/Inkscape), so the decision was to fold `format` into
the same modal as one more field (`ExportImageFormat = "png" | "svg"`, the first control
under "Size") rather than add a second modal or keep two disconnected menu entries.

**Outer-edge padding (`EXPORT_EDGE_PADDING`) is the one PNG behavior that looked hard to
carry to SVG**, since it was implemented by rendering smaller and compositing onto a
larger canvas (`padOuterEdge`) — a rasterization step with no obvious SVG analog. The
first plan was to ship SVG without it (silently using the "inner half" of the padding).
The actual fix — `padOuterEdgeSvg` — came from the user's own insight mid-conversation:
shifting a `viewBox`'s **origin** left by `padding`, while keeping its _size_ equal to the
physical `width`/`height`, moves everything the document shows without scaling it (a
content point at user-space x=0 lands at physical x = `0 − minX`; setting `minX` to
`-padding` lands it at `padding`). This achieves the identical visual effect as the
canvas-based path with zero rasterization — text stays text, paths stay paths — and
brought SVG to full parity rather than a documented, permanent gap.

One encoding detail worth keeping in mind if this is touched again: the SVG data URL is
`data:image/svg+xml,` + `encodeURIComponent(svg)` (Plotly's own scheme, not base64), and
`padOuterEdgeSvg` decodes it by finding the **first** comma and slicing everything after —
not splitting on every comma — because SVG path data itself routinely contains literal
commas, which `encodeURIComponent` does not escape.

### 8. CSV export replaces the hand-rolled download with `SliceTable` in a modal — except for the heatmap

`showExportCsvModal` opens a `SliceTable` (via the existing `showInfoModal` imperative
pattern) for scatter/density_1d/waterfall, so a CSV export gets the same preview-before-
you-download experience the image export already has. **Correlation heatmap's CSV export
was explicitly left as its own hand-built string + link-click path** — its CSV shape (a
matrix, not a row-per-point table) doesn't fit `SliceTable`'s row model, and generalizing
it wasn't attempted.

`SliceTable` already has its own "Download data" button, which would have been a second,
redundant completion action next to whatever the modal itself offered. Rather than build
a duplicate primary button and hide the native one, **the native button became the
modal's only completion action**, marked as such by adding a `downloadButtonBsStyle?`
prop (threaded through `@depmap/slice-table`'s `Controls` → `SliceTable`, default
unchanged for every other consumer) and setting it to `"primary"` only from
`showExportCsvModal.tsx` — so it visually reads as "the thing to click," not one option
among several.

Two mechanisms scope the table to the plot's current state, for different reasons:
`rowIds` (a `Set<string>` of currently-visible point ids, from the plot's
`filters.visible.values` mask) pushes the row restriction down into `SliceTable`'s own
fetch — the fast, common path. `implicitFilter` is the belt-and-suspenders fallback for
slices `rowIds` can't subset server-side (matrix slices, `reindex_through` chains), which
still come back whole and need filtering client-side; both are passed together rather than
relying on either alone.

### 9. CSV columns prefer real `SliceQuery`s over `CustomColumn`s, wherever the dimension collapses to one

The first implementation turned every already-computed dimension value into a
`CustomColumn` — simple, and it worked, but it throws away information `SliceTable`
could otherwise use: filtering, sorting against the live dataset, and a real column
identity instead of a frozen snapshot. The distinction that matters is
`axis_type`, not "was this a metadata field or a plotted dimension": a `raw_slice`
dimension always names exactly one dataset feature or sample, which is exactly what a
`SliceQuery` (`{dataset_id, identifier, identifier_type}`) is for; an `aggregated_slice`
dimension is a computed aggregate over an entire context (e.g. "the mean of this gene
set") and **has no `SliceQuery` representation at all** — there is no wire format for
"the mean of a context," so those keep falling back to a `CustomColumn` carrying the
value the plot already computed. `dimensionToSliceQuery` (`showExportCsvModal.tsx`)
implements exactly this split and returns `null` (→ `CustomColumn` fallback) for anything
that doesn't collapse.

The real-world shape that broke the first pass at this: a `raw_slice` dimension's
context is not always `vars`-keyed (`{gene: {dataset_id, identifier, ...}}`, the shape
filter-contexts use) — the common case is `vars: {}` with the identity encoded entirely
in `expr: {"==": [{"var": "given_id"}, id]}`. Rather than hand-parse `expr`,
`dimensionToSliceQuery` reuses `contextToSliceSelection`
(`DimensionSelectV2/DimensionSliceSelect/sliceSelectAdapters.ts`) — the existing inverse
of what `DimensionSliceSelect` itself writes when someone picks a dimension this way — and
determines `identifier_type` as `"sample_id"` vs `"feature_id"` by comparing
`context.dimension_type` against the plot's own `index_type`. Metadata slices are simpler
and needed no equivalent split: they arrive already resolved to a `sliceQuery` or not by
the time a `DataExplorerPlotResponse` reaches this code, so metadata is a `CustomColumn`
only when the backend itself had no `SliceQuery` for it (deliberately out of scope to
chase further — "I don't care about the metadata, that can stay as a custom column").

This code also assumes `DataExplorerContext` V1 is fully retired — contexts are cast to
`DataExplorerContextV2` rather than checked for it, because V1 links only exist pre-
bootstrap conversion; there is no V1 payload for this code to ever actually see at
runtime.

### 10. Save now closes the modal

`handleClickSave` calls `onHide()` after triggering the download, for both formats. It
previously stayed open, which was a leftover from before there was a reason to leave
(nothing else to check afterward); once save always produces a file, leaving the modal up
was just an extra click to dismiss it.

## Traps that are already contained (do not "simplify" them away)

- **A capability flag's absence means "behaves like before," never "unimplemented."**
  Every `PreviewPlotSupport` flag's default was chosen to make it a no-op for every
  renderer that predates it. Flipping a default to make one call site's flag-passing
  shorter would silently change every other renderer's export.
- **Any field inside a `cached || freshDefault` fallback only takes effect the first time
  the fallback literal runs.** See §4. If a per-render prop needs to reach a cached
  object, it goes outside the `||`, always.
- **A `null` in a `shapes`/`annotations`/similar array is not equivalent to omitting the
  entry**, once the figure goes through `Plotly.toImage` rather than `Plotly.react`. Filter
  it out before it reaches export, don't rely on it being ignored.
- **Setting `tickwidth`/`tickcolor` at all — even to today's implicit default — changes
  Plotly's own default for `ticks`.** There is no way to set a grid/zeroline width without
  also forcing `ticks: ""` explicitly if tick marks must stay hidden.
- **The SVG data URL is `encodeURIComponent`-encoded, not base64, and must be split on the
  first comma only.** Path data contains literal commas that a naive `split(",")` would
  misread.
- **jest-localstorage-mock's `getItem`/`setItem` are `jest.fn()`s, and this workspace's
  `jest-setup.ts` calls `jest.resetAllMocks()` in a global `afterEach`** (to reset the
  `@depmap/api` auto-mocks). That collaterally strips the _implementation_ off any other
  `jest.fn()`-backed mock too — including `jest-localstorage-mock`'s, which installs one
  instance per test file and expects it to survive every test in that file. The visible
  symptom is `localStorage` silently going dead (`getItem` returning `undefined`, not
  `null`) starting with the second test in a file that touches it, while the same test
  passes in isolation. A test file that depends on `localStorage` round-tripping across
  more than one `test()` needs to re-establish the mock itself, in its own `beforeEach`
  (`jest.spyOn(window.localStorage, "getItem"/"setItem"/"clear").mockImplementation(...)`),
  rather than relying on the `setupFiles`-installed instance's persistence.

## Consequences

- A new plot type gains export support by implementing `RenderPlotOptions`/`renderPlot`
  and setting whichever `PreviewPlotSupport` flags diverge from the defaults — not by
  editing the modal.
- `chromeLineWidth`/`dataLineWidth`/`format`/`tickFontSize` join the growing list of
  export-only settings (`edgePadding`, `violinLineWidth` before them) that intentionally
  have no equivalent in the global Settings modal.
- CSV export for scatter/density_1d/waterfall is now previewable and filterable before
  download; correlation_heatmap's CSV export is unchanged and was not generalized.
- Tests: `calcChromeAxisOverrides` (`prototype/__tests__/plotUtils.test.ts`),
  `padOuterEdgeSvg` (`ExportImageModal/__tests__/padOuterEdgeSvg.test.ts`), the shared/
  per-type remembered-settings split (`ExportImageModal/__tests__/rememberedConfig.test.ts`),
  and `dimensionToSliceQuery`/`buildTableConfig` (`plot/__tests__/showExportCsvModal.test.ts`)
  cover the mechanisms most likely to silently regress.
