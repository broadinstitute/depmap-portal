const path = require("path");
const webpack = require("webpack");
const jsonImporter = require("node-sass-json-importer");

// Builds the MCP App view into ONE self-contained file, mcp.html, that an MCP
// host renders in a sandboxed iframe. Everything (JS, CSS, any fonts/images)
// is inlined; the page makes no request to any other URL.
//
// It lands in Breadbox's static/embed folder so the existing single-page-app
// mount serves it at /embed/mcp.html. That means two things:
//   - this build must NOT clean that folder, and
//   - it must run AFTER webpack.prod.js, which does clean it.
// `yarn build` runs them in that order.
//
// Unlike webpack.prod.js this deliberately does not extend webpack.common.js
// (no HtmlWebpackPlugin, no CSS extraction).

const OUT_DIR = path.resolve(
  __dirname,
  "../../../",
  "breadbox/breadbox/static/embed"
);

const MARKER_META = '<meta name="mcp-api-version" content="1">';

// Script text is placed inside <script>...</script>. The HTML parser would end
// the element early at "</script", and "<!--" followed by "<script" switches
// it into the "script data double escaped" state, so neither may appear
// literally. Each replacement is the same string once JavaScript parses it
// (inside a string or regex literal, which is the only place these can occur
// in minified output).
function escapeForInlineScript(js) {
  return js
    .replace(/<!--/g, "<\\x21--")
    .replace(
      /<(s)cript/gi,
      (m, s) => `<\\x${s.charCodeAt(0).toString(16)}cript`
    )
    .replace(/<\/script/gi, "<\\/script");
}

class InlineIntoHtmlPlugin {
  constructor({ jsName, htmlName }) {
    this.jsName = jsName;
    this.htmlName = htmlName;
  }

  apply(compiler) {
    const { Compilation, sources } = compiler.webpack;

    compiler.hooks.thisCompilation.tap(
      "InlineIntoHtmlPlugin",
      (compilation) => {
        compilation.hooks.processAssets.tap(
          {
            name: "InlineIntoHtmlPlugin",
            stage: Compilation.PROCESS_ASSETS_STAGE_OPTIMIZE_INLINE,
          },
          () => {
            const js = compilation.getAsset(this.jsName);
            if (!js) {
              throw new Error(`InlineIntoHtmlPlugin: ${this.jsName} not found`);
            }

            const script = escapeForInlineScript(js.source.source().toString());
            const html = [
              "<!DOCTYPE html>",
              '<html lang="en">',
              "<head>",
              '<meta charset="UTF-8">',
              '<meta name="viewport" content="width=device-width, initial-scale=1.0">',
              MARKER_META,
              "<title>Data Explorer Plot</title>",
              "</head>",
              "<body>",
              '<div id="root"></div>',
              `<script>${script}</script>`,
              "</body>",
              "</html>",
              "",
            ].join("\n");

            compilation.deleteAsset(this.jsName);
            compilation.emitAsset(this.htmlName, new sources.RawSource(html));
          }
        );
      }
    );
  }
}

module.exports = {
  mode: "production",

  // No source maps: nothing external to reference, and inlining one would
  // roughly double the file.
  devtool: false,

  entry: {
    mcp: "./src/mcp/index.tsx",
  },

  output: {
    // Emitted, then folded into mcp.html and removed by the plugin below.
    filename: "[name].js",
    path: OUT_DIR,
    publicPath: "",
  },

  optimization: {
    splitChunks: false,
    runtimeChunk: false,
  },

  performance: { hints: false },

  plugins: [
    new webpack.optimize.LimitChunkCountPlugin({ maxChunks: 1 }),
    new webpack.ProvidePlugin({ process: "process/browser" }),
    new webpack.DefinePlugin({
      "window.enabledFeatures": JSON.stringify({ embed: true }),
      // A Plotly dependency uses Node's `global`.
      global: "window",
    }),
    new InlineIntoHtmlPlugin({ jsName: "mcp.js", htmlName: "mcp.html" }),
  ],

  resolve: {
    extensions: [".tsx", ".ts", ".js"],
    modules: [path.resolve("./"), "node_modules"],
    fallback: {
      stream: require.resolve("stream-browserify"),
    },
  },

  module: {
    // Make every import() eager (bundled into the entry chunk, resolved
    // immediately) so the Plotly loaders and lazy modals need no extra
    // request. Affects this build only.
    parser: {
      javascript: { dynamicImportMode: "eager" },
    },

    rules: [
      {
        test: /\.tsx?$/,
        exclude: /node_modules/,
        use: "ts-loader",
      },
      {
        // Styles end up in the JS and are injected as <style> at runtime.
        test: /\.css$/,
        use: ["style-loader", "css-loader"],
      },
      {
        test: /\.scss$/,
        use: [
          "style-loader",
          {
            loader: "css-loader",
            options: {
              modules: {
                localIdentName: "[hash:base64]",
              },
            },
          },
          {
            loader: "sass-loader",
            options: {
              webpackImporter: false,
              sassOptions: { importer: jsonImporter() },
            },
          },
        ],
      },
      {
        // Fonts and images become data: URIs.
        test: /\.(woff2?|ttf|eot|png|jpe?g|gif|svg)$/,
        type: "asset/inline",
      },
    ],
  },
};
