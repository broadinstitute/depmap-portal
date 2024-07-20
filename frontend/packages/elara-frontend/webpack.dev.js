const merge = require("webpack-merge").merge;
const common = require("./webpack.common.js");
const ReactRefreshWebpackPlugin = require("@pmmmwh/react-refresh-webpack-plugin");
const ReactRefreshTypeScript = require("react-refresh-typescript");
const jsonImporter = require("node-sass-json-importer");

module.exports = merge(common, {
  mode: "development",

  devtool: "cheap-module-source-map",

  output: {
    filename: "[name].js",
  },

  devServer: {
    port: 8001,
    hot: true,
    historyApiFallback: true,
    client: {
      overlay: false,
    },
    proxy: {
      "/elara/**/*.(ico|js|map|woff|woff2)": {
        target: "http://127.0.0.1:8001/",
        pathRewrite: { "^/elara/": "" },
      },
      "!/elara/**": {
        target: "http://127.0.0.1:8000/",
        secure: false,
        logLevel: "debug",
      },
    },
  },

  plugins: [new ReactRefreshWebpackPlugin({ overlay: false })],

  module: {
    rules: [
      {
        test: /\.tsx?$/,
        exclude: /node_modules/,
        use: [
          {
            loader: require.resolve("ts-loader"),
            options: {
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
