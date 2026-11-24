import type { ExpoConfig, ConfigContext } from 'expo/config';

const PROGUARD_KEEP_RULES = [
  '-keep class com.pinmi.react.printer.** { *; }',
  '-keep class com.reactnativegooglesignin.** { *; }',
  '-keep class com.google.android.gms.** { *; }',
  '-keep class com.google.android.libraries.identity.googleid.** { *; }',
  '-keep class com.bumptech.glide.** { *; }',
  '-assumenosideeffects class android.util.Log {',
  '    public static int v(...);',
  '    public static int d(...);',
  '}',
].join('\n');

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'src dimas kasir',
  slug: 'src-dimas-kasir',
  owner: 'denaripp',
  version: '0.3.5',
  icon: './assets/icon.png',
  orientation: 'portrait',
  scheme: 'srcdimaskasir',
  userInterfaceStyle: 'light',
  platforms: ['android'],
  android: {
    package: 'com.srcdimas.kasir',
    versionCode: 8,
    allowBackup: false,
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
          usesCleartextTraffic: false,
          enableProguardInReleaseBuilds: true,
          enableShrinkResourcesInReleaseBuilds: true,
          useLegacyPackaging: true,
          enableBundleCompression: true,
          extraProguardRules: PROGUARD_KEEP_RULES,
        },
      },
    ],
    [
      'expo-splash-screen',
      {
        backgroundColor: '#FFFFFF',
        image: './assets/icon.png',
        imageWidth: 140,
      },
    ],
    [
      'expo-font',
      {
        fonts: [
          './node_modules/@expo-google-fonts/plus-jakarta-sans/400Regular/PlusJakartaSans_400Regular.ttf',
          './node_modules/@expo-google-fonts/plus-jakarta-sans/500Medium/PlusJakartaSans_500Medium.ttf',
          './node_modules/@expo-google-fonts/plus-jakarta-sans/600SemiBold/PlusJakartaSans_600SemiBold.ttf',
          './node_modules/@expo-google-fonts/plus-jakarta-sans/700Bold/PlusJakartaSans_700Bold.ttf',
          './node_modules/@expo-google-fonts/plus-jakarta-sans/800ExtraBold/PlusJakartaSans_800ExtraBold.ttf',
        ],
      },
    ],
    [
      'expo-camera',
      {
        cameraPermission:
          'Izinkan src dimas kasir mengakses kamera untuk memindai barcode barang.',
        recordAudioAndroid: false,
      },
    ],
    'expo-secure-store',
    'expo-web-browser',
    [
      '@react-native-google-signin/google-signin',
      {
        iosUrlScheme:
          'com.googleusercontent.apps.649442221316-gdq947707fmcvrh5i4011bbrs5bidf0n',
      },
    ],
    './plugins/withThermalPrinterFix',
    './plugins/withAndroidSecurityHardening',
    './plugins/withAndroidAbiFilter',
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
