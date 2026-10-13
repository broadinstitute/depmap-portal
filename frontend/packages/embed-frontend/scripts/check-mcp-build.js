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

if (failures.length) {
  console.error(`FAIL: ${file}`);
  failures.forEach((f) => console.error(`  - ${f}`));
  process.exit(1);
}

console.log(`OK: ${file} (${(fs.statSync(file).size / 1e6).toFixed(2)} MB)`);
