const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

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

// Replace the 34 MB lucide barrel with a slim shim of only the icons used.
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === 'lucide-react-native') {
    return {
      filePath: path.resolve(__dirname, 'lib/lucide-shim.js'),
      type: 'sourceFile',
    };
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
