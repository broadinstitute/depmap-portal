const path = require("path");
const { CleanWebpackPlugin } = require("clean-webpack-plugin");

// Bundles src/node/cli.ts into a single script that runs under plain Node (no
// DOM, no React). It lands in its own folder under Breadbox's static/, which is
// not mounted as a web app, so Breadbox can run the script but never serves it.
// It ships with the same Docker build step as the browser bundle.
//
// This deliberately does not extend webpack.common.js (HTML, CSS, and browser
// polyfills are all irrelevant here). The folder holds nothing else, so it is
// safe for this build to empty it.
//
// If this build starts failing on a .scss file or a browser-only module, some
// import has crept into the standalone entry's dependency graph that shouldn't
// be there. Fix the import rather than adding a loader.
module.exports = {
  mode: "production",

  target: "node",

  devtool: "source-map",

  entry: {
    "plot-data": "./src/node/cli.ts",
  },

  output: {
    // No content hash: other programs need to be able to find this by name.
    filename: "[name].js",
    path: path.resolve(
      __dirname,
      "../../../",
      "breadbox/breadbox/static/plot-data"
    ),
  },

  plugins: [new CleanWebpackPlugin()],

  resolve: {
    extensions: [".tsx", ".ts", ".js"],
    modules: [path.resolve("./"), "node_modules"],
  },

  module: {
    rules: [
      {
        test: /\.tsx?$/,
        exclude: /node_modules/,
        use: "ts-loader",
      },
    ],
  },
};
