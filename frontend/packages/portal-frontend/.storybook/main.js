const path = require("path");
const devConfigFn = require("../webpack.dev.js");
const tsConfig = require("./tsconfig.storybook.json");

const devConfig = devConfigFn({}, {});
devConfig.module.rules[0].use[0].options = {};

module.exports = {
  framework: {
    name: "@storybook/react-webpack5",
    options: {},
  },
  docs: {
    autodocs: true,
  },
  typescript: {
    check: true,
    checkOptions: {
      typescript: {
        configOverwrite: tsConfig,
      },
    },
  },
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
