const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

config.transformer = {
  ...config.transformer,
  minifierConfig: {
    compress: {
      reduce_funcs: false,
    },
  },
};

config.resolver = {
  ...config.resolver,
  unstable_enablePackageExports: false,
};

module.exports = config;
