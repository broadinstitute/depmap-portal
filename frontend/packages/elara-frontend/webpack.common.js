const path = require("path");
const webpack = require("webpack");
const HtmlWebpackPlugin = require("html-webpack-plugin");
const ESLintPlugin = require("eslint-webpack-plugin");

module.exports = {
  entry: {
    elara: "./src/index.tsx",
  },

  plugins: [
    new ESLintPlugin({
      context: path.resolve("../../packages"),
      files: ["**/src/**/*.@(ts|tsx)"],
      quiet: true,
      cache: true,
      cacheLocation: path.resolve(
        "../../node_modules/.cache/eslint-webpack-plugin/.eslintcache"
      ),
    }),
    // https://stackoverflow.com/a/64553486
    new webpack.ProvidePlugin({ process: "process/browser" }),
    new HtmlWebpackPlugin({
      template: "public/index.html",
      favicon: "public/favicon.ico",
      publicPath: "",
    }),
    new webpack.DefinePlugin({
      "window.enabledFeatures": JSON.stringify({
        linear_association: false,
        use_taiga_urls: false,
        precomputed_associations: false,
      }),
      "window.depmapContactUrl": JSON.stringify(
        "mailto:dmc-questions@broadinstitute.org"
      ),
      "window.errorHandler": "({ report: console.error.bind(console) })",
    }),
  ],

  resolve: {
    extensions: [".tsx", ".ts", ".js"],
    modules: [path.resolve("./"), "node_modules"],
    fallback: {
      stream: require.resolve("stream-browserify"),
    },
  },

  optimization: {
    moduleIds: "deterministic",
    runtimeChunk: "single",
    splitChunks: {
      cacheGroups: {
        vendor: {
          // We split dependencies into their own chunk so they can be
          // cached by the browser. However, we don't want to do that too
          // aggressively. Some application bundles don't need all of that.
          // Also, caching the whole node_modules directory would mean that
          // introducing any new dependency invalidates that cache. This is
          // a compromise: include only libraries that are large, upgraded
          // infrequently, and commonly required.
          test: ({ resource }) =>
            [
              "d3",
              "d3-scale",
              "popper\\.js",
              "react",
              "react-base-table",
              "react-bootstrap",
              "react-dom",
              "react-router-dom",
              "react-motion",
              "react-overlays",
              "react-select",
              "react-table",
            ].some((module) =>
              RegExp(`[\\/]node_modules[\\/]${module}[\\/]`).test(resource)
            ),
          name: "vendors",
          chunks: "all",
        },
      },
    },
  },
};
