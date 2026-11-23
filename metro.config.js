const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');

const config = getDefaultConfig(__dirname);

config.resolver = {
  ...config.resolver,
  extraNodeModules: {
    ...(config.resolver?.extraNodeModules ?? {}),
    'react-native-ping': path.resolve(__dirname, 'src/lib/stubs/react-native-ping.js'),
  },
};

module.exports = withNativeWind(config, { input: './global.css' });
