# ADR 0012 — Selecting points in the MCP view hands entities to the assistant as plain text

- **Status:** Accepted, with open items (see "Not yet verified")
- **Applies to:** `embed-frontend/src/mcp/` (`ReadyPlot.tsx`, `selection.ts`), the `Embedded*`
  plots and `PlotSelection.ts`, `useSelection`, the three scatter/density renderers'
  `modebarSelectionTools` prop, and the `expand_by` paragraph of `generating-de2-links.md`.
- **Key symbols:** `MAX_SELECTED_ENTITIES`, `hostAcceptsMessages`, `selectionMessage`,
  `modebarSelectionTools`, `pairGrained`, `PlotSelection`, `HeatmapSelection`, `ui/message`
- **Builds on:** ADR 0003 (the link-generation doc is part of the mechanism), ADR 0007
  (expansion), ADR 0011 (the MCP view and its fixed-height document).

---

## Context

A user looking at a plot in a chat often wants to ask about a handful of points, usually
outliers: "what do these cell lines have in common?" The assistant already has tools that
take entities (a context of ids for a two-class comparison, gene symbols for a gene set), so
what is missing is only a way to say _which_ entities, without the user retyping names.

Three facts shaped the design and are not visible in the code:

- **Hosts differ in what `ui/message` does.** Delphi puts the text in the message box as an
  unsent draft. claude.ai fills its input box. ChatGPT sends it at once.
- **A point is not always an entity.** In an expanded plot (`expand_by`) one entity appears
  once per member (19,338 points for one gene across cell lines), so "the selected points"
  has no single meaning unless the plot is faceted by the expansion.
- **Data values must stay out of the conversation.** ADR 0011 keeps plot data in the view's
  memory on purpose. A selection that carried the plotted numbers would undo that.

## Decision

**A selection is a list of entities, sent to the host as a plain-text user message when the
user clicks a button in the view.**

### What is selected

**Selection is on the plot's `index_type` entity, using `useSelection`.** The view does not
have its own selection model. Scatter, density and waterfall use the box and lasso tools in
Plotly's toolbar, exactly as Data Explorer's selection does. The correlation heatmap keeps
its own interaction (click a cell) and selects the two entities it compares.

**Selection is off, with a one-line explanation under the plot, where points are
(entity, member) pairs:** the plot is expanded and not faceted by the expansion
(`pairGrained` in `useSelection`). This is deliberately broader than "coloured by the
expansion without faceting", so the view and the plot agree on what a point is.

**The link-generation doc tells the model to set `"facet_by": "expansion"` whenever it uses
`expand_by` on a scatter.** The model should not emit plots that cannot be selected on, and
that confuse readers anyway. This is a change to the contract in ADR 0003; the doc's heading
and version are untouched.

### What is sent

**`selectionMessage` produces a readable list and nothing else:**

```
I selected 3 cell lines in the plot of <y> against <x>:
- NIHOVCAR3 (ACH-000001)
- ...
```

Ids and display labels, taken from one index so they match, distinct entities in data order.
Ids because they stay valid across data releases and tools take them; labels because some
tools take labels (gene symbols) and the user can read what they are sending. **No values, no
JSON, no machine-readable block.** The assistant builds any context expression itself, with
the tools it already has.

**It is sent with `app.sendMessage({ role: "user", ... })` and only from a click.** Nothing is
sent on selection.

**At most `MAX_SELECTED_ENTITIES` (50) distinct entities.** Above that the button is
disabled and says so. 50 is a conservative guess about how many ids the model can copy into
a tool call reliably; it is one constant because it is expected to change.

### Where it is offered

**Any host that declares `message` text.** `hostAcceptsMessages` reads
`getHostCapabilities().message.text`; it does not look at the host's name. An earlier draft
allowed Delphi only, because a capability cannot tell a host that drafts the message from
one that sends it. The product owner decided to accept ChatGPT's immediate send for now.

### The toolbar, not our own buttons

**The plots keep Plotly's modebar, with its box and lasso buttons, behind an opt-in prop,
`modebarSelectionTools`.** Data Explorer leaves it off and uses its own toolbar. With it on,
the plot follows the drag mode the modebar picks: the plots hold the drag mode as React
state, so without that a modebar click would be undone by the next re-render. The button and
a hint ("Use the box or lasso tool…") live in the existing 28 px row under the plot, so the
document is still plot plus that row (ADR 0011); the row now also exists when selection is
offered, even with no link.

## Why this is easy to undo by accident

- **The `modebarSelectionTools` sync looks redundant.** Without it the toolbar buttons appear
  and then snap back to zoom after the first selection.
- **Dropping `pairGrained` for a plain "has expansion" test** makes selection silently
  wrong on expanded plots that are faceted by expansion, which are the clean case.
- **Adding values or JSON to the message** looks like a convenience. It puts plot data into
  a stored conversation, which ADR 0011 exists to avoid.
- **Narrowing or widening the host check** changes what ChatGPT users see. Anyone changing
  it should know a capability check cannot tell drafting hosts from sending hosts.
- **Dropping the line in `generating-de2-links.md`** leaves the model free to emit expanded,
  unfaceted scatters that are unselectable. Nothing fails; the button just disappears.

## Considered options

- **Delphi only.** Rejected after being first chosen: it was the safe answer to ChatGPT's
  immediate send, but it kept the feature out of claude.ai, which fills its input box.
- **A note on the model context (`updateModelContext`) instead of a message.** Rejected: a
  note is capped at about 600 characters, and 30 ids with labels exceed that. The user also
  could not read or edit it.
- **Our own Zoom/Box/Lasso buttons.** Built first, then removed: they cost a row of height and
  duplicated a toolbar the plot already has.
- **A machine-readable block in the message** (JSON of ids). Rejected: the box stays
  readable and editable without it, and the model already builds context expressions.
- **A handle to a stored selection, for selections above the cap.** Not built. It would
  expand to the same context on the server, so downstream there is one path. Storing it in
  Breadbox's `/temp/cas` was agreed in principle (the owners are one team), but it is a
  permanent, ownerless record and a new write path from the MCP server, so it needs
  validation, limits and an unlogged handle when built.
- **A convenience `ids` parameter on the comparison tool.** Not done. Add it only if the
  model's calls built from a selection are often wrong.

## Consequences

- **Good:** one selection model for Data Explorer and the view; nothing in the view to keep
  in step with it except the `pairGrained` condition.
- **Good:** no data values leave the view, and nothing is sent without a click.
- **Good:** a host gains the feature by declaring `message`, with no list to maintain.
- **Bad:** on ChatGPT the click sends the message at once, with no chance to edit it.
- **Bad:** the cap of 50 is a guess, and a user with more points has no path yet.
- **Bad:** the toolbar only appears on hover, so a host without hover never shows it; the
  hint helps only after it is seen.
- **Bad:** selection on expanded plots is off wherever the plot is not faceted by the
  expansion, and relies on the model following one line of a document nothing checks.
- **Neutral:** the heatmap selects by clicking a cell (the pair), not by drag.

## Not yet verified

- ChatGPT: the immediate send, and whether its draft mode would be better. Not tried for
  selection.
- The cap of 50: the measurement (give the model N ids, check its tool call reproduces them)
  was deferred.
- A host with no hover (touch): whether the modebar is reachable.
- Whether the model's calls from a selection are often wrong enough to need the `ids`
  parameter; nothing has measured it.
