# ADR 0013 — Annotation route choice is deterministic and skips shortcut FKs

- **Status:** Accepted
- **Applies to:** `@depmap/selects` (`AnnotationSelect/computeLevel.ts`), and by extension
  any other implementation of "which chains can reach this type" (the planned Breadbox
  reachable-columns endpoint, `generating-de2-links.md`)
- **Key symbols:** `computeLevel`, `planTraversal`, `groupColumns`,
  `deriveNavStateFromValue`, `SliceQuery.reindex_through`
- **Builds on:** ADR 0006 (chain semantics and traversal model)

---

## Context

When a dimension type has more than one way to reach another type, the chain picker offers
only one. Which one used to depend on the order of the columns in the table's API response:
`computeLevel` was depth-first with a single shared `visited` set, so the first FK column to
claim a type won and later routes were silently dropped. For `screen` → `depmap_model`,
that meant `ModelConditionID` first gave the long route and `ModelID` first gave the direct
one. Column order is not a contract, so the offered route, and therefore the chain a link
carries, could change without any schema change.

That matters because the route is baked into `SliceQuery`s that end up in long-lived links.
The picker highlights the selected row only when the value structurally equals the chain of
an _offered_ row, so a route the picker stops offering still renders but loses its highlight.

There is a second, subtler problem. `screen.ModelID` exists because, when it was added,
nothing could derive the model from `ModelCondition`. With `reindex_through` it can be
derived, so the column is redundant and could be removed without losing anything. A rule
that prefers the direct column mints links that break the day it is removed.

## Decision

1. **Drop shortcut FKs first.** At each table, a single FK is a shortcut when its target is
   also reachable by following another single FK in the same table. Shortcuts are not
   offered; the route through the intermediate type is. If two FKs reach each other,
   neither is a shortcut. Reachability ignores types already visited or claimed.
2. **Then shortest route wins.** Among the routes that remain, the one with the fewest hops
   claims the target. Ties go to the alphabetically first FK column names along the route
   (first hop first), then to the parent type name. Column declaration order is never
   consulted.
3. **Doors are unchanged.** A target with two or more FKs from one table is still a door
   and is never auto-traversed.

Losing routes are still not offered. The picker is a presentation layer, not the
authority on what the resolver accepts.

## Considered options

- **Keep column order.** Deterministic given a response, not across them. Rejected.
- **Shortest path, then FK name.** The first choice here, on the grounds that it is easiest
  to explain. Rejected: auto-traversed hops are collapsed in labels, so users never see the
  route length, and graph distance systematically picks denormalized shortcuts, which are
  the columns most likely to be removed.
- **Alphabetical by FK name only.** Simple, but arbitrary: `ModelConditionID` beating
  `ModelID` would be luck.
- **Explicit "derived" metadata on the FK.** The cleanest answer, but a data-model change
  across Breadbox. Out of scope; the reduction rule approximates it from the schema.

## Consequences

- **Good:** the offered route depends only on the schema's FKs, not column order. Links
  minted through the long route survive removal of a shortcut column.
- **Good:** `screen`'s group order in the picker is again Model Condition (1 hop) before
  Model (2 hops), since groups sort by hop count.
- **Bad:** the picker's behavior changes. A saved link that went through a shortcut FK
  still renders and resolves, but no row is highlighted when the dropdown opens.
- **Bad:** the rule cannot tell whether a shortcut is the only _populated_ route. A screen
  with `ModelID` set and `ModelConditionID` null returns a value through the direct route
  and null through the long one, because an unmatched FK at any hop yields null.
- **Bad:** `deriveNavStateFromValue` still counts every FK in a table to decide door versus
  auto-traversal, while `computeLevel` ignores FKs to targets already visited or claimed.
  The two can disagree about whether a hop is a door. This is documented by a test and not
  fixed here.
- **Neutral:** any other implementation of reachability (Breadbox's reachable endpoint)
  must apply the same rules, and the contract test must assert them.
