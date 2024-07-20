const path = require("path");
const devConfig = require("./webpack.config.js");

module.exports = {
  framework: {
    name: "@storybook/react-webpack5",
    options: {},
  },
  docs: {
    autodocs: true,
  },
  typescript: { check: false, checkOptions: {} },
  stories: ["../src/**/*.stories.mdx", "../src/**/*.stories.@(js|jsx|ts|tsx)"],
  addons: ["@storybook/addon-links", "@storybook/addon-essentials"],
  webpackFinal: (config) => {
    config.resolve.modules.push(path.resolve(__dirname, ".."));
    return {
      ...config,

      resolve: {
        ...config.resolve,
        ...devConfig.resolve,
      },

      module: { ...config.module, rules: devConfig.module.rules },
    };
  },
};
