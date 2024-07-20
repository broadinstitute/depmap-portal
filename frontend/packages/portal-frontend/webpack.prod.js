const path = require("path");
const merge = require("webpack-merge").merge;
const { CleanWebpackPlugin } = require("clean-webpack-plugin");
const { WebpackManifestPlugin } = require("webpack-manifest-plugin");
const jsonImporter = require("node-sass-json-importer");
const common = require("./webpack.common.js");

module.exports = merge(common, {
  mode: "production",

  devtool: "source-map",

  output: {
    filename: "[name].[contenthash].js",
    path: path.resolve(
      __dirname,
      "../../../",
      "portal-backend/depmap/static/webpack"
    ),
    publicPath: "",
  },

  plugins: [new WebpackManifestPlugin(), new CleanWebpackPlugin()],

  module: {
    rules: [
      {
        test: /\.tsx?$/,
        exclude: /node_modules/,
        use: "ts-loader",
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
    ],
  },
});
