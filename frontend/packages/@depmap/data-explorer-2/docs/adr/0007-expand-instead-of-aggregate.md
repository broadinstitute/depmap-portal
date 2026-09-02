# ADR 0007 — Expansion is a per-axis choice: "expand instead of aggregate"

- **Status:** Accepted
- **Applies to:** `@depmap/data-explorer-2` — `DimensionSelectV2`,
  `AggregateOrExpandToggle`, `plotConfigReducer` (`select_expansion`),
  `fetchExpandedPlot`; and Transcript Explorer, which is unaffected.
- **Key symbols:** `AggregateOrExpandToggle`, `expand_by` / `DataExplorerExpandBy`,
  `isExpansionDimension`, `getExpansionAxes`, `getExpansionAxis`, `select_expansion`,
  `handleExpansionSelection`; and, for the member set,
  `maxExpansionMembersFor`, `chooseExpansionMembers`, `selectBestMembers`,
  `varianceLowerBound`, `ExpansionRoute`

---

## Context

An **expansion** fans each index entity out into one point per member of a context:
`depmap_model × transcript`, N points becoming N×M. Until now it existed only inside
Transcript Explorer, driven by a bespoke gene picker, and had no control in Data Explorer
proper.

The question was what that control should be. Two framings were built and compared.

### The framing that lost: an expansion is a property of the point set

An expansion changes what a point _is_, which argues that its control belongs next to
`index_type` on the Points selector — "Points: cell lines × transcripts" — with each axis
separately choosing whether to read per-pair. It generalizes cleanly (a third pairing reads
fine where a third axis does not), it makes the two-axis cases fall out for free, and it
lets the config say each thing exactly once.

It was implemented, and rejected on the only ground that ultimately matters: **nobody could
be expected to conceptualize it.** It asks the user to assemble a hybrid index up front,
before any axis means anything, and then separately explain to each axis how to read it.
Every part of the model is defensible and the whole is unlearnable.

### The framing that won

An axis that resolves a context of many members already has to say what to do with them —
today it aggregates. Expanding is simply another answer to that same question:

> **You have a context of transcripts. Aggregate them into one number, or expand them into
> one point each.**

That is one new option on a control the user is already using, in a place they are already
looking, phrased in terms they already have. The expansion is _implied_ by the axis
configuration rather than assembled separately.

## Decision

**Expanding is a per-axis choice about how that axis resolves its own context.** It is
offered as an Aggregate/Expand toggle wherever an axis is an `aggregated_slice`, and the
axis's own `slice_type` and `context` become the expansion.

### 1. The sentinel stays on `aggregation`, and under this framing that is honest

`aggregation` is documented as "a resolution-mode discriminator: how an axis turns a
slice*type into per-index values." Expanding is exactly that — the mode where the members
\_aren't* collapsed. `aggregation: "expansion"` is the same bit the Aggregate/Expand toggle
sets, so the config says what the UI says.

(An earlier draft moved this to a third `axis_type` value on the grounds that the sentinel
conflated "how this reads" with "which axis owns the expansion." Under the points-scoped
framing that conflation was real. Under this one it isn't: the axis genuinely does both, and
that is the whole idea.)

**There is no schema version bump.** Nothing about an existing payload changes meaning: a
single expanding axis is spelled today exactly as it was. The only new shape is a _second_
axis carrying the sentinel, which is purely additive — every previously-valid config still
reads identically. Compare the version-2 flip (ADR 0001/0004), which inverted what an
_absent_ field meant and therefore had to be versioned.

### 2. The opposite axis can join, but never start a rival expansion

One expansion per plot: `expand_by` is a single-element array, and the materializer rejects
more. But a second axis may **join** the one already defined — expanding over the same
members while reading them from **its own dataset**. That is the same Aggregate/Expand
toggle, not a separate concept, and it is what unlocks:

- **Short-read vs long-read.** Both axes expand the transcripts of CD44 from different
  assays. One point per (model, transcript), answering whether the two agree.
- **Per-pair vs aggregate on the same type.** x expands the transcripts; y takes the mean
  over them. Arguably the most illuminating comparison the feature enables — and the exact
  config the old shape-based routing silently broke (see §5).

The toggle is disabled only when joining is impossible: another axis is expanding and this
one is over a _different_ type, so it could not look those members up. The reason is stated
on hover rather than left as a dead control.

**Only the axes, though — never `dimensions.color` or `dimensions.facet`.** An expansion
says what a _point_ is, and the point set is defined by the axes; color and facet are
readings of it. Both already have a first-class way to express the common need
(`color_by: "expansion"` / `facet_by: "expansion"` partition by member, needing no dimension
of their own), so the sentinel there would have to mean something else entirely: "color by
this point's member's value in some third dataset."

That is coherent, and there is one real use case for it — x and y as two assays of the same
transcript, colored by a per-pair coverage or QC score, to see whether disagreement tracks
with low coverage. Color being the third axis, nothing else can express it. It is deliberately
not supported: nobody has asked, and it would require a dimension that can _join_ an expansion
but never _define_ one, which contradicts §3 (any expanding dimension becomes the definer when
the others leave, and that symmetry is what makes swapping free). Revisit it as a whole if the
need appears; do not enable it piecemeal.

Enforced in three places, which must agree — they briefly did not, and the gap let a
hand-authored `color` expansion half-work: `getExpansionAxes` (x/y only, so the reducer's
reconciliation covers exactly the dimensions that can expand), `normalize` (demotes a sentinel
anywhere else), and `fetchExpandedPlot` (rejects it outright, for callers that bypass the
reducer).

### 3. Joining axes are indistinguishable in the config, deliberately

A joining axis gets the defining axis's `slice_type` and `context` mirrored onto it. Both
axes then carry the sentinel over the same members, differing only in `dataset_id`.

They really are symmetric, and encoding that pays off immediately: **swapping the axes needs
no bookkeeping at all**, because there is nothing asymmetric to swap.

The defining/joining distinction is therefore **purely presentational** — `getExpansionAxis`
returns the first expanding axis (x before y), and that is the one whose context picker stays
live. A joining axis shows the inherited context, disabled and labelled as shared. If the
definer leaves, the joiner simply becomes the definer, its picker becomes live, and the plot
is unchanged.

### 4. Mirroring the context is redundancy, and it is worth it

The members are stated three times: on `expand_by`, and on each expanding dimension. Only
`expand_by`'s copy is read by the materializer.

The alternative — a per-pair axis with no `context` — was tried. It forces a special case
into `isCompleteDimension` and into all three serialization passes
(`replaceContextsWithHashes`, `replaceHashesWithContexts`, `convertAllLegacyContexts`), each
of which reasonably assumes every dimension has a context. Mirroring keeps an expanding axis
an _ordinary_ `aggregated_slice` dimension everywhere outside the expansion code, which is
worth more than the duplication costs.

Keeping the copies in agreement is `select_expansion`'s job and can only be done there. That
is why `handleExpansionSelection` dispatches that action **alone** — a `select_dimension`
alongside it would overwrite the dimension with the raw selection, undoing the members a
joining axis just inherited.

### 5. `normalize` demotes an expanding axis that drifts off the expansion's type

An expanding axis reads its values by looking the expansion's members up in its own dataset,
on the axis implied by its `slice_type`. A mismatch doesn't error — it finds nothing and the
axis goes **silently all-null**.

Several routes can cause that drift without going through `select_expansion`: a `slice_type`
inferred after a data-type change, a whole-dimension `select_dimension`, a hand-authored
link. So `normalize` demotes any expanding dimension whose `slice_type` disagrees with
`expand_by`'s, and then drops `expand_by` if that was the last one.

This is the same hazard class as the routing bug fixed in "fix issue with combining expanded
and unexpanded axes" (`7bf76fa3c`, on master via #727): the materializer must identify
expanding axes by the **sentinel**, never by `(axis_type, slice_type)` shape, because shape
also catches an ordinary aggregated dimension that happens to share the expansion's type.
That fix predates this ADR and was motivated independently, but it is a precondition for
what follows — the case it fixes stops being exotic the moment two axes can be
transcript-typed at once, which is precisely what this ADR enables.

## Consequences

- **`isExpansionDimension` may be true of more than one dimension.** Anything asking "which
  axis is _the_ expansion axis?" should use `getExpansionAxes` and decide what it means by
  more than one, or `getExpansionAxis` if it only needs the presentational owner.
- **An expansion records `slice_type`, `context`, and optionally `members`.** It used to
  also carry a `limit` (page size) and an `offset` (window start), which had to survive a
  re-issue under carefully different conditions. Both are gone: the materializer shows the
  members that vary most across the entities being plotted rather than an arbitrary prefix,
  so there is one fixed cap and nothing left for the config to say about how many. When two
  axes expand, x's dataset arbitrates the ranking.
- **`members` is the one field whose meaning depends on the context beside it.** It holds
  ids the user picked in the member table, and those ids belong to a particular member set —
  so `normalize` drops them whenever `expand_by`'s own context moves. Deliberately narrower
  than the `outOfSync` reconciliation it sits inside: that is also true when only a _joining_
  axis drifted, and in that case the member set hasn't changed and the selection should
  stand.
- **Transcript Explorer is untouched.** It drives expansion through its own gene picker on
  one axis and never passes `allowExpansion` to the other, so it cannot reach the join path.
- **Two axes expanding the same dataset** give `y === x` and a perfect diagonal. Nothing
  prevents it; it's a discoverable dead end rather than an error.
- **Multi-expansion (N×M×P) remains deferred.** Worth noting that this framing does not
  generalize to it — "expand" is a choice one axis makes, and a second expansion would need
  a second axis to make it, which runs out. If drug-dose-replicate data ever forces the
  issue, the points-scoped framing rejected above is the one that scales, and this ADR is
  the record of why it was not chosen on comprehensibility grounds.

## Learned while implementing

None of the following was understood when the decision above was taken. Each cost real
iteration, and each is a trap that will be re-sprung by anyone touching this code.

### Sparse data is the normal case, and it takes three counts to describe

A context names entities; the dataset measures some of them, usually not most; and when two
axes expand from **different** datasets, only their intersection can draw a point. So
`total_in_context`, `available_count` and `shown_count` are three genuinely different
numbers, and the UI was conflating them into claims it could not keep ("Showing 14 of 29"
with six on screen and 14 unreachable).

The rule that came out of it: **a number on screen must be derived from what was drawn, not
from what was requested.** The instructive failure is that `shown_count` applied the joint
rule (a value on every expanding axis, at the same index entity) while `available_count`
asked the ranking dataset alone. The two therefore disagreed whenever the axes differed,
`shown < available` stayed true no matter what the user picked, and the member control went
on offering members no selection could reach. Both now intersect across
`getExpansionAxes`; `available_count` remains an upper bound, since "has data in each
dataset" is weaker than "has data in each for the same entity" and the exact answer would
cost a fetch per candidate.

### The cap is derived from the index size, so nothing may store or hardcode it

`maxExpansionMembersFor` scales the member limit down as the index the expansion multiplies
grows. Three consequences that are easy to get wrong:

- **User-facing copy has to hedge.** "shows at most 9" reads as a bug to someone who saw 25
  on a different plot; "a plot this size shows at most 9" does not.
- **`expand_by` deliberately records no count.** A stored one goes stale the moment the plot
  points at a differently sized dataset — which is why `limit`/`offset` are gone rather than
  merely unused.
- **A saved selection can exceed the current ceiling.** Any "refuse an over-cap selection"
  guard must therefore permit _shrinking_, or a plot saved under a higher ceiling can never
  be edited back down. Judging the resulting size alone locks the table.

### A ranking may deprioritize; it must never disqualify

The first member ranking excluded anything below a minimum observation count. The effect
was visible immediately and inexplicable from the interface: the picker's default selection
was non-contiguous when sorted by the very column that had chosen it. A threshold inside a
ranking always surfaces as an unexplained gap in whatever displays that ranking. It was
replaced with a chi-square lower confidence bound (`varianceLowerBound`, Wilson–Hilferty),
which discounts a thin sample instead of dropping it — the same shape as the category
ranking's `√(1/n)` shrinkage.

### `getExpansionAxis` is for display; anything about the point set needs `getExpansionAxes`

§3 calls the definer/joiner distinction "purely presentational", and it is — but
`getExpansionAxis` is a tempting answer to "which dataset do I ask?", and it was used for
exactly that in three places. Two were right (the cap and the ranking need _an_ arbiter, and
x is it by convention). The third, availability, was wrong, because the question was about
the point set rather than about a preference. When in doubt: if the answer must hold for
every drawn point, it is `getExpansionAxes`.

### The member control has no home when neither color nor facet uses the expansion

Expand an axis, color by an annotation, don't facet. The expansion's members now appear in
no legend and no Facets panel, yet the member set still decides how many points get drawn.
The control therefore has a third render site in `ViewOptions`, where it reads less like
editing a visible list and more like a cap on plot density. It is also the only one of the
three that cannot hide itself, because the configuration column has no plot response and so
has neither count. Not a bug; a case the framing above did not anticipate.

### The member table and the category table are the same widget twice

Both rank, cap, let the user override, and open sorted by the column that did the ranking.
They were built separately and every improvement had to be back-filled: the select-all
ceiling, the initial sort, the search bar, the shrinkage term. They are not shared code and
probably should not be (one is a `SliceTable`, the other a bare `ReactTable`), but **treat a
change to either as a change to both.**

### Coverage is an optional input, deliberately

Knowing how much of the context a dataset actually contains needs Breadbox's
`POST /temp/context/dataset-coverage`. `fetchContextCoverage` returns null for both a thrown
error and an empty result, so a Breadbox without that endpoint degrades to plain `priority`
ordering rather than breaking dataset selection. That is what makes the deploy order not
matter — keep it that way.

Both halves of that null are load-bearing. `getContextDatasetCoverage` answers a failure with
`{ counts: {}, total: 0 }` rather than throwing, so catching alone is not enough: read
literally, a zero total says every dataset covers none of the context, which disables every
version and strands the user. Treating it as "no opinion" is what actually delivers the
degradation promised above.

Coverage **gates**; `priority` ranks. Coverage decides only whether a version holds enough of
the context to answer the question at all, and a version below that floor is ordered last
rather than removed — the distinction drawn in "A ranking may deprioritize; it must never
disqualify" above. An earlier revision ranked by coverage outright, which overrode the curated
order on trivial differences; don't reintroduce that.

## Related

- **ADR 0001 — schema versioning.** Explains why this change needs no version bump: it
  changes no existing field's meaning and inverts no default.
- **ADR 0004 — `color_by` default flip.** `color_by: "expansion"` and
  `facet_by: "expansion"` are unaffected here — they read `expand_by`, not the dimensions,
  and never cared how many axes expand. The reducer still installs `facet_by: "expansion"`
  as a one-time default on the enable transition, and an absent `color_by` already means
  "match facet_by", which is why `handleExpansionSelection` sets neither explicitly.
