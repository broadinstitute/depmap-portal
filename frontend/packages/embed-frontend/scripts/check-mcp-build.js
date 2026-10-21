#!/usr/bin/env node
// Sanity-checks the output of `webpack --config=webpack.mcp.js`: that mcp.html
// is really self-contained and will actually run when a host loads it.
//
//   node scripts/check-mcp-build.js [path/to/mcp.html]

const fs = require("fs");
const path = require("path");
const vm = require("vm");

const embedDir = path.resolve(
  __dirname,
  "../../../../breadbox/breadbox/static/embed"
);
const file = process.argv[2] || path.join(embedDir, "mcp.html");

// The link-generation doc that the embed build publishes for the MCP server
// (ADR 0003 in @depmap/data-explorer-2).
const dePackage = path.resolve(__dirname, "../../@depmap/data-explorer-2");
const linksDocSource = path.join(dePackage, "docs/generating-de2-links.md");
const linksDocCopy = path.join(embedDir, "generating-de2-links.md");
const plotVersionSource = path.join(
  dePackage,
  "src/components/DataExplorerPage/plot-version.ts"
);
// The MCP server accepts the doc only if it starts with this heading and
// contains "describes version N". Do not reword either without telling it.
const LINKS_DOC_HEADING = "# Generating links to Data Explorer 2";
const failures = [];

function check(ok, message) {
  if (!ok) failures.push(message);
}

function checkMcpHtml(html) {
  check(
    /<meta\s+name="mcp-api-version"\s+content="1"\s*>/.test(html),
    'missing <meta name="mcp-api-version" content="1">'
  );

  // The escaping in webpack.mcp.js guarantees the script text has no literal
  // "<script" or "</script"; so the document must contain exactly one of each.
  const opens = html.match(/<script/gi) || [];
  const closes = html.match(/<\/script/gi) || [];
  check(
    opens.length === 1 && closes.length === 1,
    `expected exactly 1 <script> element but found ${opens.length} opening / ` +
      `${closes.length} closing tags (unescaped "</script" in the bundle?)`
  );

  const start = html.indexOf("<script>");
  const end = html.lastIndexOf("</script>");
  check(start >= 0 && end > start, "could not locate the inline <script>");

  if (start >= 0 && end > start) {
    const scriptText = html.slice(start + "<script>".length, end);
    check(!scriptText.includes("<!--"), 'script text contains "<!--"');

    try {
      new vm.Script(scriptText); // parse only; does not run
    } catch (e) {
      check(false, `script text does not parse: ${e.message}`);
    }

    // Everything outside the script is the markup we wrote; no attribute
    // there may point at another URL.
    const markup = html.slice(0, start) + html.slice(end + "</script>".length);
    const refs = markup.match(
      /\s(?:src|href|srcset|data|poster)\s*=\s*"?[^\s">]+/gi
    );
    check(
      !refs,
      `markup references other resources: ${(refs || []).join(", ")}`
    );
    check(!/<link\b/i.test(markup), "markup contains a <link> element");
    check(
      !/@import|url\(/i.test(markup),
      "markup contains CSS fetching other URLs"
    );
  }
}

if (!fs.existsSync(file)) {
  console.error(`FAIL: ${file} does not exist`);
  process.exit(1);
}

checkMcpHtml(fs.readFileSync(file, "utf8"));

// Only when checking the real build: the MCP build must not have removed the
// regular embed assets (webpack.prod.js cleans this folder; mcp must run after).
if (!process.argv[2]) {
  check(
    fs.existsSync(path.join(embedDir, "index.html")),
    "static/embed/index.html is missing: did webpack.mcp.js run before webpack.prod.js?"
  );
  check(
    fs.readdirSync(embedDir).some((f) => /^embed\..+\.js$/.test(f)),
    "static/embed has no embed.*.js bundle"
  );
  check(
    !fs.existsSync(path.join(embedDir, "mcp.js")),
    "stray mcp.js was left in static/embed"
  );
}

// Only when checking the real build.
function checkLinksDoc() {
  if (!fs.existsSync(linksDocCopy)) {
    check(false, `${linksDocCopy} is missing`);
    return;
  }

  const copy = fs.readFileSync(linksDocCopy);
  check(
    copy.equals(fs.readFileSync(linksDocSource)),
    "generating-de2-links.md differs from its source in data-explorer-2/docs"
  );

  const text = copy.toString("utf8");
  check(
    text.startsWith(LINKS_DOC_HEADING),
    `generating-de2-links.md must start with "${LINKS_DOC_HEADING}"`
  );

  const described = text.match(/describes version (\d+)/);
  check(
    described,
    'generating-de2-links.md has no "describes version N" phrase'
  );

  const constant = fs
    .readFileSync(plotVersionSource, "utf8")
    .match(/export const CURRENT_PLOT_VERSION\s*=\s*(\d+)/);
  check(constant, "could not read CURRENT_PLOT_VERSION from plot-version.ts");

  if (described && constant) {
    check(
      described[1] === constant[1],
      `generating-de2-links.md describes version ${described[1]} but ` +
        `CURRENT_PLOT_VERSION is ${constant[1]}: update the doc (ADR 0003)`
    );
  }

  // Models copy the doc's examples far more reliably than they follow its
  // prose, and a plot with no `version` is silently read as the pre-versioning
  // schema (for example, a facet_by plot with every point grey). So every
  // complete plot example (a ```json block with a "plot_type") must carry the
  // current version.
  if (constant) {
    const blocks = [...text.matchAll(/```json\n([\s\S]*?)```/g)];
    let plotExamples = 0;

    blocks.forEach((block) => {
      if (!block[1].includes('"plot_type"')) return;

      plotExamples += 1;
      const line = text.slice(0, block.index).split("\n").length;
      const stamped = block[1].match(/"version"\s*:\s*(\d+)/);

      check(
        stamped && stamped[1] === constant[1],
        `generating-de2-links.md: the plot example at line ${line} must ` +
          `include "version": ${constant[1]}`
      );
    });

    check(
      plotExamples > 0,
      "generating-de2-links.md: found no plot examples to check"
    );
  }
}

if (!process.argv[2]) {
  checkLinksDoc();
}

if (failures.length) {
  console.error(`FAIL: ${file}`);
  failures.forEach((f) => console.error(`  - ${f}`));
  process.exit(1);
}

if (!process.argv[2]) {
  console.log(
    `OK: ${linksDocCopy} (matches source; describes the current plot version)`
  );
}
console.log(`OK: ${file} (${(fs.statSync(file).size / 1e6).toFixed(2)} MB)`);
