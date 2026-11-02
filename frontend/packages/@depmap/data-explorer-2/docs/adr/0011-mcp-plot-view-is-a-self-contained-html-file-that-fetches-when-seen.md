# ADR 0011 — The MCP plot view is one self-contained HTML file that fetches its data when seen

- **Status:** Accepted, with open items (see "Not yet verified")
- **Applies to:** `embed-frontend/src/mcp/` and `webpack.mcp.js`, the `mcp.html` it writes into
  Breadbox's `static/embed/`, and the plot components the view renders (`PlotView` and the
  `Embedded*` plots, which now have a second consumer with a hard WebGL budget).
- **Key symbols:** `mcp.html`, `mcp-api-version`, `get_plot_data`, `VISIBLE_DEBOUNCE_MS`,
  `MAX_RECOVERY_ATTEMPTS`, `heightFromHost`, `releaseWebglContexts`, `codeGenerationBlocked`,
  `LimitChunkCountPlugin`, `dynamicImportMode: "eager"`
- **Builds on:** ADR 0010 (`POST /temp/plot-data` and the plot-data service behind it).

---

## Context

An MCP server exposes a tool that shows a Data Explorer plot. The host (Claude, ChatGPT, ...)
renders **one HTML file** in a sandboxed iframe, hands it the tool result, and lets it call
app-only tools back through the host. The view has no credentials and no route to Breadbox
of its own, so it gets its data by calling an MCP tool (`get_plot_data`), whose answer is
the `data` object from ADR 0010.

Three facts about hosts shaped everything below, and none of them is visible in the code:

- The file must be **self-contained**. The sandbox gives it no origin it can fetch assets
  from, so a second script, stylesheet or font is a request that fails.
- Hosts **mount every past view of a chat at once**, and some discard a view within about
  half a second.
- A page may hold only **16 live WebGL contexts**, shared by all of its views, and the
  browser silently evicts the oldest, even from a visible view. A scattergl plot holds two,
  so about eight plots per page. Plotly does not redraw after a loss.

## Decision

**Build the view as its own bundle, `mcp.html`, and make `get_plot_data` a request the view
makes, once, when it has been seen.**

### One file

**`webpack.mcp.js` emits a single HTML file with all JS and CSS inlined, and nothing it
references lives elsewhere.** No code splitting (`splitChunks: false`,
`LimitChunkCountPlugin` with one chunk), the Plotly loaders' `import()`s made eager for this
build only (`dynamicImportMode: "eager"`; the normal embed build is unchanged), styles
injected by `style-loader`, no fonts (the view does not import `index.scss`), no source maps.
`global` is defined as `window` because a Plotly dependency reads it.

**Script text is escaped when written into the HTML**: `<!--`, `<script` and `</script`
become `<\x21--`, `<\x73cript` and `<\/script`. Otherwise the parser ends the element early
and the page silently never runs. `scripts/check-mcp-build.js` fails the build if the file
has more than one `<script>` element, if the script does not parse, or if the markup
references another URL.

**`mcp.html` carries `<meta name="mcp-api-version" content="1">`.** Breadbox serves
`static/embed` as a single-page app and answers a missing file with `index.html` and HTTP
200, so "the request succeeded" proves nothing. The MCP server uses the tag to tell the real
file from the fallback.

**It lands in `static/embed/`, so build order matters.** `webpack.prod.js` cleans that
folder; `webpack.mcp.js` must therefore run after it and must never clean it. `yarn build`
runs them in that order, so `build-docker-image.sh` is unchanged. This is the opposite choice
to ADR 0010's `static/plot-data/`, which is not served and so can have its own folder. Here
serving is the point.

**`/embed/mcp` no longer exists as a route in the SPA.** The MCP SDK is out of the regular
embed bundle.

### Fetch when seen

**The tool result is only remembered. The view calls `get_plot_data` once, after it has been
continuously visible for `VISIBLE_DEBOUNCE_MS` (400 ms).** Visibility is an
`IntersectionObserver` on the view's root, because `document.visibilityState` stays
`"visible"` for an iframe scrolled out of sight. Leaving view cancels the timer; coming back
later does not refetch. The data is kept in memory only: no IndexedDB, no `localStorage`.

### Release WebGL contexts by unmounting

**When the view leaves the screen the plot is unmounted; when it returns it is mounted again
from the data in memory.** The plot components already call `releaseWebglContexts` (the
`WEBGL_lose_context` extension) and `Plotly.purge` on unmount, which is what frees the
contexts. `Plotly.purge` alone does not (see the comment on `releaseWebglContexts`). We did
not take a Plotly handle or add a prop for this.

**On `webglcontextlost` while visible, the plot is remounted** after a random 200 to 1500 ms
delay. The event does not bubble, so the listener is on the root with capture. At most one
recovery is in flight per view; after `MAX_RECOVERY_ATTEMPTS` (3) the view shows "Plot
unavailable, click to retry". A recovery that survives 10 s resets the count. Losses on
detached canvases (the ones we release ourselves) and while off screen are ignored.

**Views do not coordinate.** They are separate iframes.

**If `new Function` throws (a host CSP without `unsafe-eval`, such as VS Code), the view
fetches nothing and shows a message with the Data Explorer link.** regl compiles shaders with
it, so the alternative is a blank plot.

### Size

**The view's height is never a function of the height the host reports for it.** The plot is
480 px, capped by `containerDimensions.maxHeight` when that is a number. A fixed
`containerDimensions.height` is ignored. The document is the plot plus a fixed 28 px link
row, always, including while the plot is unmounted.

## Why this is easy to undo by accident

- `containerDimensions.height` looks like the right plot height. It is the iframe's height,
  which is what `autoResize` last reported. Using it as the plot height and reporting plot +
  link row back makes the iframe grow by the link row on every round. ChatGPT did exactly
  this; Claude does not, which is why it was not caught first.
- Removing the visibility gate "fixes" nothing visible and costs one `get_plot_data` per past
  view of every chat, plus up to two contexts each.
- A change to the plot components that holds a context across unmount, or that draws without
  `releaseWebglContexts`, brings the 16-context limit back and nothing fails until a long
  chat.
- A second `<script>`, a font, or an `import()` that is not eager in `webpack.mcp.js` looks
  harmless and breaks the file in a sandbox.

## Considered options

- **Keep the `/embed/mcp` route in the SPA.** Rejected: several chunks and a stylesheet the
  sandbox cannot fetch, and the MCP SDK shipped to every embed page.
- **Put the plot data in the `show_data_explorer_plot` tool result.** Rejected; see below.
- **Fetch on arrival.** Rejected: hosts mount every past view at once and discard some
  immediately, so this issues a request, and creates contexts, for views nobody sees.
- **Keep every view mounted and rely on loss recovery alone.** Rejected: a chat of a dozen
  plots exceeds the budget permanently and the views evict each other in a loop.
- **A static snapshot (`Plotly.toImage`) while off screen.** Not done. It would avoid a
  blank view until it returns, but it needs the Plotly instance, which the plot components
  do not expose, and the remount is quick. Revisit if blank views are noticed.
- **Coordinate contexts across views.** Rejected: they are separate iframes in a sandbox.
- **Mount the view from a separate static directory in Breadbox instead of sharing
  `static/embed`.** Not taken, to avoid touching `startup.py`. It would remove the build-order
  coupling.

### Rejected: put the plot data in the `show_data_explorer_plot` tool result

The tool could assemble the data itself (call Breadbox, as `get_plot_data` does) and return
it in `structuredContent`, so the view would need no second call. We rejected it for these
reasons:

1. **The model would receive the data.** The model must see only text; neither the model
   nor the host should be trusted with more than they need. Hosts put `structuredContent`
   into what the model can read. Measured on claude.ai and ChatGPT with a 200 KB result: the
   content was duplicated into the model-visible result on both. Assembled plot data
   measured 3 KB to 2.1 MB (about 18,000 index entries for a scatter), so this would put up
   to megabytes into the model's context on every plot, with cost and latency, and let a
   model quote or reason over raw values it should not be handed.
2. **It does not fit Delphi (our reference host).** Delphi stores tool messages in
   Firestore, whose document limit is 1 MB. We already hit this once, when FastMCP put every
   tool result into `structuredContent`; Delphi now keeps `structured_content` only for
   tools with a UI and only small configs. 2 MB of plot data would exceed the limit for the
   largest plots.
3. **It is delivered at the wrong time.** Hosts re-send a tool result to its view whenever
   the view is mounted, and Claude mounts every past view of a chat when the chat is opened
   (measured: three views started within 1.4 s, two discarded within 0.4 s). Data in the
   tool result would be pushed to every past plot, visible or not, and would be kept in the
   conversation history. With a separate `get_plot_data` call the view fetches only after it
   has been visible for a short debounce, and the data lives only in the view's memory,
   never in the chat transcript or host storage.
4. **Data at rest in the host.** The tool result becomes part of the stored conversation,
   in the host's storage, outside our control. The data may come from access-controlled
   datasets in a future per-user version. Keeping the tool result to the config means
   nothing but the config is stored.
5. **Size limits are unknown per host.** We measured `callServerTool` passing 8 MB on
   Claude, ChatGPT and VS Code, but did not measure how large a tool _result_ each host will
   accept, store and replay. Using the call we have measured is the safer choice.

Embedding the data in the `ui://` HTML was also rejected: the resource is a static,
prefetched template that hosts cache by URI (ChatGPT reads it at tool-listing time), so it
cannot carry per-plot data.

Cost of the choice: one extra host round trip per plot (0.4 to 0.8 s on Claude, 0.8 to 3 s
on ChatGPT through a tunnel), and the view needs a host that supports `serverTools` (all
three hosts we tested do; hosts without it are unsupported).

## Consequences

- **Good:** one file to hand to a host, checked at build time; the regular embed bundle is
  smaller and no longer depends on the MCP SDK.
- **Good:** the cost of a long chat is bounded by what is on screen, not by its length.
  Measured with a probe in the many-views harness (`mcp-harness/many.html?same=1`): with two
  views on screen 13 of 16 contexts were free, the same after scrolling through twelve views,
  and the same 30 s later, so unmounting frees contexts immediately and nothing waits for
  garbage collection. Forcing evictions with the probe made visible plots flicker and redraw
  within a second or two, from memory, with no request.
- **Good:** `PlotView` and the plot components are unchanged and still shared with
  `/embed/plot`.
- **Bad:** the output depends on build order. Running `webpack.mcp.js` before
  `webpack.prod.js`, or adding a clean to it, silently deletes the other. The check script
  catches the first; nothing catches a new cleaning step.
- **Bad:** the file is about 2.4 MB, nearly all Plotly and React, and is inlined with no
  caching between hosts that reload it.
- **Bad:** an off-screen view is blank until it returns, and a plot redraws (losing zoom and
  any selection) whenever it is remounted, whether by scrolling or by loss recovery.
- **Bad:** the probe only sees the views' contexts if they share its renderer process, which
  needed `allow-same-origin` on the harness iframes. Without it the probe reported 16 free
  in every state and measured nothing. A host that isolates its views will not share a
  budget the way our harness did, and the page-wide budget there is unknown.
- **Bad:** the visibility and recovery constants (400 ms, 200 to 1500 ms, 3 attempts, 10 s)
  were chosen, not derived.
- **Bad:** every plot costs one extra host round trip (see the rejected option above), and
  a host without `serverTools` support cannot show the view at all.
- **Neutral:** the link opens through `app.openLink`, since a sandboxed iframe cannot
  navigate itself.

## Not yet verified

- ChatGPT, since the resize fix: its iframe handling, observer behavior and sizing.
- A host that blocks `new Function`: `codeGenerationBlocked` is covered by a mocked test
  only.
- The give-up path under real conditions: only fake `webglcontextlost` events have exercised
  the third failed recovery.
- Whether hosts that keep views mounted in the same page as ours behave like the harness
  with `same=1`.
