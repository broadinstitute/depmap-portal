const path = require("path");
const webpack = require("webpack");
const HtmlWebpackPlugin = require("html-webpack-plugin");

module.exports = {
  entry: {
    embed: "./src/index.tsx",
  },

  plugins: [
    new webpack.ProvidePlugin({ process: "process/browser" }),
    new HtmlWebpackPlugin({
      template: "public/index.html",
      publicPath: "",
    }),
    new webpack.DefinePlugin({
      "window.enabledFeatures": JSON.stringify({ embed: true }),
    }),
  ],

  resolve: {
    extensions: [".tsx", ".ts", ".js"],
    modules: [path.resolve("./"), "node_modules"],
    fallback: {
      stream: require.resolve("stream-browserify"),
    },
  },
};
