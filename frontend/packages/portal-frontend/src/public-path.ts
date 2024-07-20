const element = document.getElementById("webpack-config");

if (element) {
  const webpackConfig = JSON.parse(element.textContent as string);

  // This tells Webpack where resource URLs that look like they're at the root
  // level can actually be found. This needs to be set so it can load any
  // asynchronous chunks (that is, modules that are imported as dynamic
  // imports). We set this on the fly rather than in the Webpack config file
  // because we don't actually know it at build time (it's defined as
  // APPLICATION_ROOT in Flask's runtime configuration). See
  // https://webpack.js.org/guides/public-path/#on-the-fly
  __webpack_public_path__ = webpackConfig.publicPath;
}
