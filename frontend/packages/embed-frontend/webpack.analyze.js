const merge = require("webpack-merge").merge;
const prod = require("./webpack.prod.js");
const { BundleAnalyzerPlugin } = require("webpack-bundle-analyzer");

module.exports = merge(prod, {
  plugins: [
    // BundleAnalyzerPlugin creates an interactive treemap visualization of the
    // contents of all your bundles. This can be used to investigate what's
    // inside each Webpack bundle and which modules make up the bulk of their
    // size.
    new BundleAnalyzerPlugin({
      analyzerMode: "server",
    }),
  ],
});
