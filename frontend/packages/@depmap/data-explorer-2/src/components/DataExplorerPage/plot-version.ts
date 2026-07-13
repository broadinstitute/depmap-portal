// The schema version stamped on every serialized `DataExplorerPlotConfig`.
//
// Version history:
//   1 — Property names are canonical and `dimensions` is an object. This is the
//       post-mechanism, PRE-`color_by`-flip schema: an absent `color_by` still
//       means "uniform", not "group". The flip ships as version 2. Do not attach
//       new default semantics to version 1 after the fact.
//
// When a schema change ships, bump this constant AND add the corresponding
// Phase B step in `readPlotFromQueryString` in the SAME commit. The number and
// the schema semantics must move as a unit, or the reader will certify payloads
// it hasn't actually migrated.
//
// INVARIANT — every mint point stamps this. Today that means:
//   * `plotToQueryString`     (the compressed `p` param)
//   * `parseShorthandParams`  (the human-readable shorthand params)
// If you add a third way to mint a plot config, stamp it there too. The reader
// coerces an absent version to 0 and runs pre-versioning migrations against it,
// so an unstamped-but-modern payload is not merely untagged — it is actively
// mistaken for a years-old one and migrated as such.
//
// This constant lives in its own module rather than in `utils.ts` because
// `query-string-parser.ts` needs it and `utils.ts` already imports from
// `query-string-parser.ts`. Defining it here keeps the import graph acyclic.
// `utils.ts` re-exports it, so `import { CURRENT_PLOT_VERSION } from "../utils"`
// keeps working for existing callers.
export const CURRENT_PLOT_VERSION = 1;
