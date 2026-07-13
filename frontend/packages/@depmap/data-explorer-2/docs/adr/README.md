# Architecture Decision Records

Durable answers to **"why is the system this way?"**

## What goes here (and what doesn't)

The line is the reader's question:

| Question | Where it belongs |
|---|---|
| *Why is this diff the way it is?* | The commit message |
| *Why is the system the way it is?* | An ADR here |

A commit message is read by someone bisecting a regression. An ADR is read by someone about
to change something and wondering what they'd be breaking. They are different people with
different questions, and cramming both into a commit message means the second person never
finds the answer — commit messages are effectively write-only after a few months.

**Commit messages reference ADRs. ADRs do not duplicate commit messages.** If a fact will
still be true after ten more commits, it belongs here and the commit should link to it.

### Why this directory exists at all

Data Explorer's plot config is a **wire format**. Hyperlinks encode the entire
`DataExplorerPlotConfig` (compressed, in the `p` query param), so every payload we have ever
minted is still live — in bookmarks, in Slack threads, in published papers. We cannot see
those payloads, cannot migrate them in place, and cannot stop supporting them.

That makes "why is the system this way?" unusually expensive to rediscover here, because
half the constraints come from data nobody can look at. Several of our load-bearing rules
are invisible in the code and were only recovered by tracing years of history. Writing them
down once is much cheaper than deriving them again — and much safer than a future reader
concluding a constraint is arbitrary and "cleaning it up."

## The bar for writing one

**An ADR records a decision that was made.** That is the whole filter, and it cuts both ways:

- **Not a design doc.** If the decision is still open, it does not get an ADR. It lives in a
  handoff doc or an issue until it lands. Writing up open questions as "Accepted" launders
  speculation into settled architecture, which is worse than not writing it down at all.
- **Not a changelog.** If it only explains one diff, it belongs in that diff's commit message.
- **Not a style guide.** Conventions with no consequences don't need a record.

Good triggers, from the ones we have:

- A constraint that is **invisible in the code** and expensive to re-derive. (0001: absent
  `version` means "pre-versioning" *only because* every mint point stamps. Nothing in the
  code says that; delete the stamp and everything still compiles and passes.)
- A hazard that has **bitten more than once**. (0002: the same normalizer bug, three times.)
- A rule that a future reader would otherwise **"fix"**, because it looks wrong. (0001:
  environment-adaptation runs unconditionally and looks like a redundant pass. It isn't.)

If you're unsure, the question to ask is: *would someone touching this code six months from
now do the wrong thing without it?* If no, skip it.

## Conventions

- **Filename:** `NNNN-kebab-case-title.md`, four digits, sequential. Numbers are never
  reused, even if an ADR is superseded.
- **Status:** `Accepted` | `Superseded by NNNN`. That's it so far — add more only when you
  actually need them.
- **Superseding:** write a **new** ADR, flip the old one's Status, and leave the old one in
  place. Never edit an ADR's decision after the fact. The record of what we used to think, and
  why we changed our minds, is most of the value — an ADR that is silently rewritten is just
  documentation, and documentation is what we already had.
- **Corrections** (typos, broken links, a clarifying sentence) are fine to edit in place. The
  distinction is: correcting the record, versus changing the decision.

Beyond that, don't over-formalize yet. There is no template, deliberately. Write the thing a
confused reader needs; we'll notice what we reach for twice and codify *that*.
