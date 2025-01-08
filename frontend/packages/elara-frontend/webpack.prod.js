const path = require("path");
const merge = require("webpack-merge").merge;
const { CleanWebpackPlugin } = require("clean-webpack-plugin");
const MiniCssExtractPlugin = require("mini-css-extract-plugin");
const CopyWebpackPlugin = require("copy-webpack-plugin");
const common = require("./webpack.common.js");
const jsonImporter = require("node-sass-json-importer");

module.exports = merge(common, {
  mode: "production",

  devtool: "source-map",

  output: {
    filename: "[name].[contenthash].js",
    path: path.resolve(
      __dirname,
      "../../../",
      "breadbox/breadbox/static/elara"
    ),
  },

  plugins: [
    new MiniCssExtractPlugin({
      filename: "[name].[contenthash].css",
      chunkFilename: "[id].[contenthash].css",
    }),
    new CopyWebpackPlugin({
      patterns: [
        {
          from: path.resolve(__dirname, "public/static"),
          to: path.resolve(
            __dirname,
            "../../../",
            "breadbox/breadbox/static/elara/static"
          ),
        },
      ],
    }),
    new CleanWebpackPlugin(),
  ],

  module: {
    rules: [
      {
        test: /\.tsx?$/,
        exclude: /node_modules/,
        use: "ts-loader",
      },
      {
        test: /\.css$/,
        use: [MiniCssExtractPlugin.loader, "css-loader"],
      },
      {
        test: /\.scss$/,
        use: [
          MiniCssExtractPlugin.loader,
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
    ],
  },
});
