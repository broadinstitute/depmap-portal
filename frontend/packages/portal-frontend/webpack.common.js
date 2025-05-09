const path = require("path");
const webpack = require("webpack");
const ESLintPlugin = require("eslint-webpack-plugin");

module.exports = {
  entry: {
    DepMap: {
      import: "./src/index.tsx",
      library: {
        type: "global",
        name: "[name]",
      },
    },
    cellLine: "./src/apps/cellLine.tsx",
    celligner: "./src/apps/celligner.tsx",
    customAnalysis: "./src/apps/customAnalysis.tsx",
    datasetManager: "./src/apps/datasetManager.tsx",
    groupsManager: "./src/apps/groupsManager.tsx",
    privateDatasets: "./src/apps/privateDatasets.tsx",
    tdaSummary: "./src/apps/tdaSummary.tsx",
    genePage: "./src/apps/genePage.tsx",
    compoundDashboard: "./src/apps/compoundDashboard.tsx",
    tableTester: "./src/apps/tableTester.tsx",
    dataExplorer2: "./src/apps/dataExplorer2.tsx",
    contextExplorer: "./src/apps/contextExplorer.tsx",
    dataPage: "./src/apps/dataPage.tsx",
    resourcesPage: "./src/apps/resourcesPage.tsx",
    secretDataViewer: "./src/apps/secretDataViewer.tsx",
    anchorScreenDashboard: "./src/apps/anchorScreenDashboard.tsx",
    doseViabilityPrototype: "./src/apps/doseViabilityPrototype.tsx",
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

  // When importing a module whose path matches one of the following, just
  // assume a corresponding global variable exists and use that instead.
  // This is important because it allows us to avoid bundling all of our
  // dependencies, which allows browsers to cache those libraries between builds.
  externals: {
    // plotly.js is enormous and difficult to cache. There is a pre-compiled
    // bundle you can use (and even partial ones to reduce the size) but I
    // couldn't get any of that to work. It may be worth another try at some
    // point.
    // https://github.com/plotly/plotly-webpack#the-easy-way-recommended
    "plotly.js": "Plotly",
  },
};
