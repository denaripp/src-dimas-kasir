import type { ExpoConfig, ConfigContext } from 'expo/config';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'src dimas kasir',
  slug: 'src-dimas-kasir',
  owner: 'denaripp',
  version: '0.2.0',
  icon: './assets/icon.png',
  orientation: 'portrait',
  scheme: 'srcdimaskasir',
  userInterfaceStyle: 'light',
  platforms: ['android'],
  android: {
    package: 'com.srcdimas.kasir',
    versionCode: 2,
    adaptiveIcon: {
      foregroundImage: './assets/adaptive-icon.png',
      backgroundColor: '#E62129',
    },
    permissions: [
      'android.permission.CAMERA',
      'android.permission.BLUETOOTH',
      'android.permission.BLUETOOTH_ADMIN',
      'android.permission.BLUETOOTH_CONNECT',
      'android.permission.BLUETOOTH_SCAN',
      'android.permission.ACCESS_FINE_LOCATION',
    ],
  },
  plugins: [
    [
      'expo-router',
      {
        root: './src/app',
      },
    ],
    [
      'expo-build-properties',
      {
        android: {
          minSdkVersion: 26,
        },
      },
    ],
    [
      'expo-camera',
      {
        cameraPermission:
          'Izinkan src dimas kasir mengakses kamera untuk memindai barcode barang.',
      },
    ],
    'expo-font',
    'expo-web-browser',
    './plugins/withThermalPrinterFix',
  ],
  experiments: {
    typedRoutes: true,
  },
  extra: {
    router: {
      origin: false,
    },
    eas: {
      projectId: 'c8aae741-7265-4790-bfb7-ab0f341c5bef',
    },
  },
});
