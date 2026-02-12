const path = require("path");
const merge = require("webpack-merge").merge;
const common = require("./webpack.common.js");
const ESLintPlugin = require("eslint-webpack-plugin");
const ReactRefreshWebpackPlugin = require("@pmmmwh/react-refresh-webpack-plugin");
const ReactRefreshTypeScript = require("react-refresh-typescript");
const jsonImporter = require("node-sass-json-importer");

const devConfig = (env, argv) => ({
  mode: "development",

  devtool: "cheap-module-source-map",

  output: {
    filename: "[name].js",
    publicPath: "http://127.0.0.1:5001/depmap/static/webpack",
  },

  devServer: {
    port: 5001,
    hot: true,
    client: {
      overlay: false,
    },
    // We need to enable cross-origin requests to the dev server since it's
    // running on localhost:5001 while Flask is on localhost:5000 (the port is
    // considered part of the origin).
    headers: {
      "Access-Control-Allow-Origin": "http://127.0.0.1:5000",
      "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, PATCH, OPTIONS",
      "Access-Control-Allow-Headers":
        "X-Requested-With, content-type, Authorization",
    },
  },

  plugins: [
    new ReactRefreshWebpackPlugin({ overlay: false }),
    env.transpileOnly === "true"
      ? null
      : new ESLintPlugin({
          context: path.resolve("../../packages"),
          files: ["**/src/**/*.@(ts|tsx)"],
          quiet: true,
          cache: true,
          cacheLocation: path.resolve(
            "../../node_modules/.cache/eslint-webpack-plugin/.eslintcache"
          ),
        }),
  ].filter(Boolean),

  experiments:
    env.transpileOnly === "true"
      ? {
          lazyCompilation: {
            entries: true, // Lazy-compile entry points
            imports: true, // Also lazy-compile dynamic imports
            test: (module) => {
              // Return false to exclude from lazy compilation
              return !/src\/index\.tsx/.test(module.nameForCondition?.() || "");
            },
          },
        }
      : {},

  module: {
    rules: [
      {
        test: /\.tsx?$/,
        exclude: /node_modules/,
        use: [
          {
            loader: require.resolve("ts-loader"),
            options: {
              transpileOnly: env.transpileOnly === "true",
              getCustomTransformers: () => ({
                before: [ReactRefreshTypeScript()],
              }),
            },
          },
        ],
      },
      { test: /\.css$/, use: ["style-loader", "css-loader"] },
      {
        test: /\.scss$/,
        use: [
          "style-loader",
          {
            loader: "css-loader",
            options: {
              modules: {
                // https://webpack.js.org/loaders/css-loader/#localidentname
                // use '[hash:base64]' for production
                // use '[path][name]__[local]' for development
                localIdentName: "[path][name]__[local]",
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
    ],
  },
});

module.exports = (env, argv) => merge(common, devConfig(env, argv));
