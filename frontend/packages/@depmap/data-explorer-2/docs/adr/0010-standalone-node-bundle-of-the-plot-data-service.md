# ADR 0010 — The plot-data service ships as a standalone, credential-free Node bundle

- **Status:** Accepted
- **Applies to:** `services/dataExplorerAPI` and everything it imports, `ClientSettings` in
  `@depmap/api`, and the build in `embed-frontend`. The service is no longer only browser
  code, so edits to its dependency graph have a second consumer.
- **Key symbols:** `fetchPlotData`, `fetchPlotLinearRegression`, `configureBreadboxClient`,
  `ClientSettings`, `runPlotDataRequest`, `PlotDataOutcome`, `api_version`,
  `webpack.node.js`, `plot-data.js`, `dimensionHelpers.ts`, `contextExpr.ts`

---

## Context

Something outside the browser needs "the data behind this `DataExplorerPlotConfig`".
Assembling that data is not a single Breadbox call: `fetchPlotDimensions`,
`fetchExpandedPlot`, `fetchWaterfall` and `fetchCorrelation` join slices, apply filters and
contexts, resolve labels and value types, and pick categories. That logic is large, and the
config it consumes is a frozen wire format (see ADR 0001). Whatever the page renders for a
given config is the contract.

The consumer is Breadbox itself. A `POST /plot-data` endpoint spawns `node plot-data.js`
once per request, and the script reads back from that same Breadbox over localhost.
Breadbox decides who the caller is and hands that to the child as request headers. The
script is therefore a component inside a service that enforces limits on it (stdout size,
memory, wall time) and parses its output mechanically. It must hold no credentials of its
own and have no opinion about how identity works, so Breadbox can change the mechanism
without touching the extract. And the parent must be able to tell "the request was bad"
apart from "the script broke".

The service was already plain async TypeScript, but its _imports_ assumed a browser:
`@depmap/globals` read `window` and `document` at import time; the Breadbox client fixed its
URL prefix at import and hardcoded `credentials: "include"`; `utils/misc.ts` imported React
and started a fetch as an import side effect; and the choice of which fetcher to call lived
inside a React hook.

## Decision

**Bundle the service itself, unchanged in behavior, as a single script
(`static/plot-data/plot-data.js`) that Breadbox runs with `node`. The page and the script call
the same `fetchPlotData`, so they cannot disagree about what a config means. The script
takes one versioned JSON document in, gives one JSON document out, and never learns how
identity works.**

Input on stdin: `{ api_version: 1, plot_config, breadbox: { base_url, headers } }`.
Output on stdout, always exactly one document:
`{ ok: true, data }` or `{ ok: false, error: { code, message, details: null } }`, where
`code` is one of `invalid_config`, `forbidden`, `dataset_not_found`, `upstream_error`.

### Identity and addressing

**`headers` is an opaque, required, non-empty map, and is never logged, inspected beyond a
type check, or defaulted.** A local Breadbox treats a request with _no_ identity header as
privileged. If the script ever sent one by accident (missing map, empty map), it would read
as an administrator. So a missing, non-object or empty `headers` is `invalid_config`, and
the script makes no request at all. It is sent with every request as-is; the client only
adds `Accept` and `Content-Type`, which it needs.

**`base_url` is the Breadbox root, and paths are unprefixed.** A request goes to
`base_url + "/datasets/..."`. The same path under the portal's `/breadbox` prefix is a 404
on Breadbox. `base_url` replaces the client's entire prefix, so no request can carry it, and
it is never derived from `window.location` or the environment.

**Credentials travel on stdin, never argv.** Argv is visible in process listings and shell
history.

**`configureBreadboxClient` is a no-op unless called, and configured clients drop
`credentials: "include"`.** The web apps never call it, so they keep resolving a relative
prefix and sending cookies. The default prefix is resolved on first use and then fixed, so
it cannot drift as a single-page app navigates. Before this, it was computed at import.

### Failure handling

**Errors are mapped from the HTTP status, not from the message.** 401 and 403 are
`forbidden`; 404 is `dataset_not_found`; 5xx, a network failure or an unparseable body is
`upstream_error`; any other 4xx (a request Breadbox rejected as malformed) is
`invalid_config`. Breadbox answers 404, not 403, for a dataset the caller isn't allowed to
see, so `dataset_not_found` deliberately covers "exists but you can't see it". Messages for
the first three are fixed, user-readable strings. The client's own messages include request
URLs and Breadbox's raw `detail`, which are not shown.

**A `200` whose body is just `{ "detail": ... }` is an error.** Some Breadbox endpoints
report failure that way, and the resource functions that know about it each check
individually. In the script's configured client the check is applied once, to every
response. It matches only an object whose sole key is `detail`, so ordinary data (objects
keyed by feature or sample ID) cannot trip it. The browser client is unchanged.

**Expected failures exit 0; only a true crash exits non-zero.** `ok: false` is a normal
answer. Anything the script cannot classify into one of the four codes is a bug in the
script and is allowed to fail loudly: a native `TypeError`, `ReferenceError`, `RangeError`
or `SyntaxError` goes to stderr with empty stdout and a non-zero exit, which the parent
treats as an internal error. These were not folded into `invalid_config` just to emit
something, because a bug presented as "your config is invalid" sends users, and us,
looking in the wrong place.

**Config problems are caught up front where they can be.** An unknown `plot_type`, a
missing `index_type`, or a required axis that is absent or incomplete is `invalid_config`
before any request is made. Problems that only surface during assembly (an unknown
dimension type, a bad context) arrive as ordinary `Error`s from the service and are
reported as `invalid_config` with their message.

**stdout is reserved for the one JSON document.** The entry rewires `console.log`,
`console.info` and `console.debug` to stderr, because any dependency that logs would
otherwise corrupt the output. The document is written in one call, compact.

### Keeping the graph Node-safe

**The service must be imported by deep path.** The `@depmap/data-explorer-2`,
`@depmap/utils` and `@depmap/selects` package roots re-export React components and
DOM-touching modules, so importing from them pulls a browser into the bundle. Hence
`@depmap/utils/src/sort`, `@depmap/selects/src/components/AnnotationSelect/*`, and the
entry importing `services/dataExplorerAPI/fetchPlotData` directly.

**`dimensionHelpers.ts` and `contextExpr.ts` must stay free of React, `window`, storage and
import-time side effects.** They were carved out of `misc.ts` and `context.ts` for exactly
this reason. Adding "just one more helper" from `misc.ts` to the service reintroduces the
React import and the import-time `getDimensionTypes()` fetch. `misc.ts` no longer
re-exports them, so the dependency has to be written deliberately.

**`data` is the `DataExplorerPlotResponse`, plus `linreg_by_group` when the config asks for
a regression line.** A scatter that sets `show_regression_line` needs the fit alongside the
points. The page fetches it separately (`fetchPlotLinearRegression`) because it draws the
plot first and the line when it arrives, and passes it along as its own prop. The script
has no such second step, so it does both before answering and puts the fit in `data`.
Breadbox passes `data` through untouched, so the fit rides inside it rather than beside it,
where a strict envelope could drop or reject it. The key is absent when no fit was
requested or computed, so every other config gets exactly the response the page would. If
computing the fit fails, the failure goes to stderr and the key is omitted, as on the
page; the plot itself is not failed. Expanded plots never get a fit: the page derives their
lines in the UI.

(Plot responses used to carry an always-empty `linreg_by_group: []` left over from the
legacy code. Nothing read it, and it would have been confused with this field, so it was
removed.)

### Build

**A separate `webpack.node.js`, writing to its own folder, `static/plot-data/`.** It has
deliberately no loaders for styles: a `.scss` or browser-only import failing this build
means the dependency graph has grown something it shouldn't have. `yarn build:embed` runs
both builds, so `build-docker-image.sh` needed no change. Webpack was kept over esbuild for
consistency with the rest of the frontend build; nothing in the contract depends on it.

**The folder is deliberately not `static/embed`.** Breadbox mounts `static/elara` and
`static/embed` as web apps and serves nothing else under `static/`, so a sibling folder is
never reachable over HTTP: the script is for Breadbox to run, not for anyone to fetch.
(It would have been harmless to expose, being a subset of Data Explorer code that already
ships to every browser, but there is no reason to.) It also keeps the two builds
independent: the browser build's `CleanWebpackPlugin` empties its own folder, so sharing
one would have made the Node build's output depend on build order. `static/` is gitignored
build output copied into the image by `COPY . /install/breadbox`, which is what carries the
script into the container. Breadbox should locate it relative to its own module rather
than the working directory.

**The output is not content-hashed.** Nothing caches it, and the parent finds it by name.

## Considered options

- **Reimplement the assembly in Python, in Breadbox or beside the MCP server.** Rejected: it
  duplicates thousands of lines of join/filter/label logic against a wire format we cannot
  migrate, and the two implementations would drift. "What does this config return?" would
  have two answers.
- **esbuild instead of webpack.** Faster and simpler for a Node target, but a new dev
  dependency and a second toolchain that resolves `@depmap/*` differently than the browser
  build.
- **Pass headers as flags or environment variables.** Rejected for the argv exposure above;
  environment variables would split one input across two channels, and the script must not
  read the environment for identity.
- **Fold unclassifiable errors into `invalid_config`.** Rejected, as above: it hides bugs
  behind a user-facing message.

## Consequences

- **Good:** one implementation. A fix to plot assembly reaches the page and the script
  together, and the script's output is what the page would have rendered.
- **Good:** the parent can trust the shape of stdout and the meaning of the exit code, and
  can change how it establishes identity without a change here.
- **Good:** the Node build is a guardrail. A new browser-only import in the service's graph
  fails the build rather than the first request.
- **Good:** an unauthorised read and a nonexistent one look the same to the caller, which is
  what Breadbox already does.
- **Bad:** the guardrail is incomplete. The build catches imports that need a loader, and
  `hasDom` covers the `window`/`document` reads that happen at import time. It does **not**
  catch `window` use inside a function that only runs on some code path (for example,
  `window.console` in `persistentApiCache.ts` and the legacy portal client, which this path
  never reaches). A new such call on the service's path will throw at runtime in Node.
- **Bad:** `fetchPlotData` and the stdin/stdout documents are now a process-boundary
  contract. `api_version` has to be maintained: a breaking change to either document needs
  version 2 and a period where the script accepts both, since Breadbox and the script ship
  from one repo but not necessarily one deploy.
- **Bad:** `data` is no longer strictly a `DataExplorerPlotResponse`. A consumer that
  renders a scatter with a regression line has to know to look for the extra key, and a
  future field of the same name added to the response type would collide with it.
- **Bad:** `invalid_config` is a lossy bucket for assembly-time errors: the message is
  whatever the service threw, and some are worded for developers.
- **Bad:** a malformed config that trips a native error deep in assembly is reported as an
  internal error, not `invalid_config`. Up-front validation narrows this but cannot close
  it.
- **Neutral:** the in-memory `cached()` layer still runs in Node and is useful within one
  invocation. The persistent IndexedDB layer fails closed without `indexedDB` and does
  nothing.
- **Neutral:** Node 18+ is required for the global `fetch`, `Headers` and `FormData`.
