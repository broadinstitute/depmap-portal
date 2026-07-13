# 0003 — The link-generation doc is a versioned contract, not documentation

**Status:** Accepted

## Context

[0001](./0001-plot-config-schema-versioning.md) put a `version` field on the wire and
established that an absent `version` means "pre-versioning" — an invariant that holds *only
because every mint point stamps*.

There are two mint points for structured payloads, and they are not alike:

1. **`plotToQueryString`** — the app's own writer. It stamps `CURRENT_PLOT_VERSION`
   mechanically, on every serialization. It cannot forget.
2. **External authors** — DepMap Delphi, and humans hand-writing URLs. These stamp only if
   the documentation tells them to, and stamp *correctly* only if the documentation and the
   code agree on what the number means.

The code cannot police the second one. A `version: 1` stamp from an external author is an
**unverifiable promise**: it asserts Breadbox `given_id`s, canonical field names, and
V2-format contexts. The reader cannot distinguish a round-tripped payload (native by
construction) from a freshly minted one (native only if the author followed the docs) —
both simply say `1`. This is precisely why 0001 refused to gate environment-adaptation on
`version`: the field certifies inline schema shape, never provenance.

The consequence is easy to miss and is the reason for this record: **the external
documentation is not a description of the system. It is part of the mechanism.** It is the
only thing that makes mint point 2 stamp correctly, and the version field's meaning depends
on it doing so.

## Decision

The Markdown document at
`frontend/packages/@depmap/data-explorer-2/docs/generating-de2-links.md` is the single
canonical source for the external link-generation contract.

- It is versioned **in lockstep with `CURRENT_PLOT_VERSION`**. The doc states which schema
  version it describes; payloads generated from it stamp that number.
- It is **colocated with the code it describes**, not in a top-level `docs/` directory.
- The Google Doc is replaced by a **stub** pointing here. It is never maintained as a
  parallel copy.
- It is **Markdown**, not `.docx`.

## Consequences

**Bumping `CURRENT_PLOT_VERSION` without updating the doc is a defect, not an omission.**
Nothing enforces it. Everything compiles, every test passes, and the app round-trips its own
links perfectly — because the app's mint point stamps mechanically. The breakage appears
only in externally-authored links, which we cannot see. This is the same class of invisible
constraint as 0001, one level up: the code is not the whole mechanism.

The failure mode is a **silent misrender, in both directions**:

- Doc teaches version-2 semantics but still says "stamp 1" → Delphi mints payloads that
  *mean* v2 while *declaring* v1 → the reader runs the v1→v2 migration on them and
  materializes an old default the author never intended.
- Doc says "stamp 2" but still teaches v1 semantics → payloads skip the migration and
  inherit new-default semantics the author didn't ask for.

Neither raises an error. Both draw the wrong plot.

**Colocation is deliberate.** A doc inside the DE2 package appears in the same PR diff as a
change to `utils.ts` or the `DataExplorerPlotConfig` type. A reviewer looking at a
`CURRENT_PLOT_VERSION` bump sees the doc sitting there unchanged, and it looks wrong. A
top-level `docs/` directory is outside the working set when editing the serializer, and gets
forgotten. Diff-locality is the enforcement mechanism, since there is no automated one.

**No parallel copies.** A Google Doc maintained alongside the Markdown will drift, and then
there are two contracts and no way to reconcile them — which is the problem the move exists
to solve. A stub cannot drift. If someone "helpfully" re-syncs the Doc into a full mirror,
that is a regression of this decision, not an improvement.

**Markdown, not `.docx`.** Agents consume the file directly (via raw GitHub), the JSON
examples are fenced code blocks rather than Word table cells with highlight markup, and the
file is diffable in review — which is what makes the lockstep rule checkable by a human at
all. A binary blob in Google Drive is checkable by nobody.

## Related

- **0001** — schema versioning; establishes the invariant this doc protects, and the reason
  `version` cannot certify provenance.
- The `color_by` default flip (schema version 2) is the first change that will exercise the
  lockstep rule. It has not been decided and has no ADR yet.
