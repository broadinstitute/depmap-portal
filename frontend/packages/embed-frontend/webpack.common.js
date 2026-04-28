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
      // HACK: For now we'll simulate Elara. But there should really
      // be an `embedded` flag or some such.
      "window.enabledFeatures": JSON.stringify({ elara: true }),
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
