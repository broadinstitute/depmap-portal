# ADR 0002 — `normalizePlot` is an allowlist normalizer

- **Status:** Accepted (describes existing behavior; the safer alternative is deferred)
- **Applies to:** `@depmap/data-explorer-2` — `normalizePlot` in `DataExplorerPage/utils.ts`
- **Read this before:** adding any field to `DataExplorerPlotConfig`

---

## Context

`normalizePlot` runs on the **write** path. Its job is to drop options that are set but
meaningless — a `color_by` whose backing dimension was never completed, a `use_clustering`
on a plot type that has no clustering — so we do not serialize junk into a URL that lives
forever.

It does this by **destructuring fields off the top** and re-adding them only in the
branches where they are meaningful:

```ts
const {
  color_by, sort_by, hide_points, use_clustering, show_regression_line, filters, metadata,
  ...rest
} = plot;
const normalized: DataExplorerPlotConfig = rest;   // <-- everything destructured is now GONE
// ...conditionally add some of them back
```

The consequence is easy to miss and has now bitten three times:

> **A field that is destructured off the top and re-added only inside conditional branches
> is a field that is *conditionally lost*.**

This is an **allowlist**: the default is to drop, and survival must be earned in every arm.
Nothing fails loudly when an arm forgets. The plot renders correctly in memory, serializes
without the field, and the loss only surfaces when the user reloads the page — at which
point the symptom (a setting that "doesn't stick") is several steps removed from the cause.

### The three instances

1. **`color_by: "expansion"`** — `color_by` was re-added only when a filter / metadata /
   color-dimension backing was complete. `"expansion"` is backed by `expand_by`, not by any
   of those, so expanded plots silently lost their coloring on write. Fixed with an explicit
   arm.

2. **`sort_by`** — re-added only *inside* the `color_by` arms, so it survived only when some
   color backing happened to be complete. An uncolored plot silently lost its sort order.
   This is why `sort_by: "alphabetical"` set via Transcript Explorer disappeared on refresh.
   Fixed by hoisting the preserve out of the color arms entirely (ADR 0001's commit).

3. **`color_by: "group"`** *(latent, arrives with the version-2 flip)* — `"group"` has **no
   backing at all**, exactly like `"expansion"`. It will be stripped unless the flip either
   adds an explicit arm or strips it *deliberately* for URL brevity. Note the trap: stripping
   is actually **sound** post-v2, because absent `color_by` in a v2 payload reads back as
   `"group"`. So the correct behavior and the bug look **identical in the diff**. It must be
   a decision with a comment, not a coincidence.

Instances 1 and 2 also show the failure is not merely "forgot an arm" — `sort_by` was
re-added in *two* arms and still lost, because the arms it was in were the wrong ones. The
hazard is **coupling a field's survival to an unrelated field's state.**

## Decision

1. **`normalizePlot` stays an allowlist for now.** Inverting it to a subtractive normalizer
   (start from the full plot, `delete` what is meaningless) would be structurally safer —
   new fields would survive by default — but it changes the drop semantics of every existing
   field at once and is not worth coupling to any in-flight change. Deferred, not rejected.

2. **Every field added to `DataExplorerPlotConfig` must be explicitly accounted for in
   `normalizePlot`.** Either it is destructured and shepherded back in *every* arm where it
   is meaningful, or it is deliberately left in `...rest` to ride through untouched. There is
   no third option, and "I didn't touch `normalizePlot`" is not one of them — a new field
   left out of the destructure rides through by default, which may or may not be what you
   want.

3. **A field's survival must not be coupled to an unrelated field's state.** If preservation
   depends on some other field being complete, that dependency must be *semantic*, not
   incidental. `sort_by` was preserved inside the `color_by` arms because of a historical
   conflation, not because sort order depends on coloring — and that is exactly why it broke.

4. **`version` is deliberately NOT destructured**, so it rides through in `...rest`. There is
   a comment in the destructure saying so, and a test pinning it. Do not "tidy" it into the
   destructure list.

5. **New fields get a test that they survive a `normalizePlot` round-trip.** This is the only
   mechanism that turns a silent, deferred, reload-time symptom into a loud, immediate one.

## Consequences

- Adding a field to `DataExplorerPlotConfig` is never a one-file change. The type, the
  normalizer, and a round-trip test move together.
- Reviewers should treat "new field on the plot config" as a prompt to open `normalizePlot`
  and ask which arms it needs to survive.
- The subtractive rewrite remains the real fix. If a fourth instance of this class appears,
  that is the signal to stop patching arms and invert the normalizer.

## Related

- ADR 0001 — Schema versioning for `DataExplorerPlotConfig` (the `version` field is the
  field referenced in decision 4; the `sort_by` fix shipped in its commit).
