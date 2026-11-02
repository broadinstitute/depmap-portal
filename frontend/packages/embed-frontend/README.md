# embed-frontend

Browser surfaces that Breadbox serves under `/embed/` (`/embed/plot`,
`/embed/table`), plus a standalone Node script (`src/node`, see ADR 0010 in
`@depmap/data-explorer-2`) and the MCP App view described below.

`yarn build` (what `build-docker-image.sh` runs) produces, in order:

1. `webpack.prod.js` → `breadbox/breadbox/static/embed/` (hashed chunks; **cleans
   the folder**)
2. `webpack.mcp.js` → `static/embed/mcp.html` and
   `static/embed/generating-de2-links.md` (then `scripts/check-mcp-build.js`)
3. `webpack.node.js` → `static/plot-data/plot-data.js`

## MCP bundle

`src/mcp/` is the view an MCP server hands to a host (Claude, ChatGPT, ...) as
a single HTML file to render in a sandboxed iframe. On `ontoolresult` it reads
`structuredContent` (`{type: "plot", params, link, api_version}`), calls the
app-only `get_plot_data` tool through the host, parses the JSON in the result's
first text part, and renders it with `PlotView`.

`mcp.html` is fully self-contained: one inline `<script>`, no code splitting
(the Plotly loaders' `import()`s are made eager for this build only), styles
injected by `style-loader`, no fonts, no source maps, and a
`<meta name="mcp-api-version" content="1">` the MCP server uses to tell it from
the single-page-app fallback (Breadbox answers a missing `/embed/*` file with
`index.html` and HTTP 200).

Because it shares `static/embed/` with the regular build, **`webpack.mcp.js`
must run after `webpack.prod.js`** and must never clean that folder.

Hosts mount every past view in a chat at once and some discard views quickly,
and Chrome allows only 16 live WebGL contexts per page (each scattergl plot
holds 2). So the view:

- stores the tool result on arrival and calls `get_plot_data` only after it
  has been continuously on screen (`IntersectionObserver` on its root) for
  `VISIBLE_DEBOUNCE_MS` (400 ms), once; the data stays in memory;
- unmounts the plot when it scrolls out of view (the plot components already
  call `loseContext` and `Plotly.purge` on unmount, which frees the contexts)
  and remounts it from the in-memory data when it comes back, keeping the
  document height constant meanwhile;
- on `webglcontextlost` while visible, remounts the plot after a random
  200 to 1500 ms delay, one recovery in flight at a time, and after 3 attempts
  shows "Plot unavailable, click to retry";
- shows a message with the Data Explorer link, and fetches nothing, when
  `new Function` is blocked by the host's CSP (regl needs it).

Views are separate iframes and deliberately don't coordinate.

### The link-generation doc

The same step publishes `@depmap/data-explorer-2/docs/generating-de2-links.md`
(ADR 0003) at `/embed/generating-de2-links.md`, unhashed so the MCP server can
fetch it from a stable URL. It is copied byte for byte and is build output
(gitignored); never edit or commit the copy. `scripts/check-mcp-build.js` fails
the build if it is missing, differs from the source, does not start with
`# Generating links to Data Explorer 2`, lacks `describes version N`, or if N is
not `CURRENT_PLOT_VERSION`. It also requires every complete plot example in the doc to carry `"version": N`. The MCP server relies on that heading and phrase.

### Building and trying it

```bash
yarn build:mcp        # just the MCP bundle + the output check (~20s)
```

This needs `static/embed/` to already exist from a full `yarn build`, since the
check also confirms the regular embed assets survived. To check a file
elsewhere: `node scripts/check-mcp-build.js path/to/mcp.html`.

To try it without a host, use the fake host in `mcp-harness/`. It plays the
host side of the MCP Apps handshake and answers `tools/call` with a canned
`/temp/plot-data` response:

```bash
# 1. Capture a response from a running Breadbox (any plot config you like)
curl -s -X POST localhost:8000/temp/plot-data -H 'content-type: application/json' \
  -d '{"api_version":1,"plot_config":{...}}' | jq .data \
  > frontend/packages/embed-frontend/mcp-harness/plot-data.json

# 2. Serve the repo root and open the harness
cd <repo root> && python3 -m http.server 8123
# http://localhost:8123/frontend/packages/embed-frontend/mcp-harness/
```

`mcp-harness/many.html?n=12` mounts N views in a column to reproduce the
context limit, with a button that probes how many contexts are still free.

The harness page logs every message in both directions. It is a test aid, not a
conformant host; real hosts (CSP, sandbox flags, sizing) still need a real test.
