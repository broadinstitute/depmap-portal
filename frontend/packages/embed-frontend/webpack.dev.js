const path = require("path");
const merge = require("webpack-merge").merge;
const common = require("./webpack.common.js");
const ReactRefreshWebpackPlugin = require("@pmmmwh/react-refresh-webpack-plugin");
const ReactRefreshTypeScript = require("react-refresh-typescript");
const HtmlWebpackPlugin = require("html-webpack-plugin");
const jsonImporter = require("node-sass-json-importer");

const devConfig = (env) => ({
  mode: "development",

  // Dev-only pages for trying McpView with hot reload. See "MCP bundle" in
  // the README.
  entry: {
    "mcp-host": "./src/mcp-dev/host.tsx",
    "mcp-view": "./src/mcp-dev/view.tsx",
  },

  devtool: "cheap-module-source-map",

  output: {
    filename: "[name].js",
  },

  devServer: {
    port: 8002,
    hot: true,
    historyApiFallback: {
      rewrites: [
        { from: /^\/embed\/mcp\/?$/, to: "/mcp-host/index.html" },
        { from: /^\/embed\/mcp-view/, to: "/mcp-view/index.html" },
      ],
    },
    client: {
      overlay: false,
    },
    static: {
      directory: path.resolve(__dirname, "./public/static"),
      publicPath: "/embed/static",
    },
    proxy: {
      "/embed/**/*.(ico|js|map|woff|woff2)": {
        target: "http://127.0.0.1:8002/",
        pathRewrite: { "^/embed/": "" },
      },
      "!/embed/**": {
        target: "http://127.0.0.1:8000/",
        secure: false,
        logLevel: "debug",
      },
    },
  },

  plugins: [
    new ReactRefreshWebpackPlugin({ overlay: false }),
    ...["mcp-host", "mcp-view"].map(
      (name) =>
        new HtmlWebpackPlugin({
          template: "public/index.html",
          filename: `${name}/index.html`,
          publicPath: "/embed/",
          chunks: [name],
        })
    ),
  ],

  module: {
    rules: [
      {
        test: /\.tsx?$/,
        exclude: /node_modules/,
        use: [
          {
            loader: require.resolve("ts-loader"),
            options: {
              transpileOnly: true,
              getCustomTransformers: () => ({
                before: [ReactRefreshTypeScript()],
              }),
            },
          },
        ],
      },
      {
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

module.exports = (env, argv) => merge(common, devConfig(env || {}, argv));
