const { withAndroidManifest } = require('expo/config-plugins');

const LEGACY_MAX_SDK_30_PERMISSIONS = new Set([
  'android.permission.BLUETOOTH',
  'android.permission.BLUETOOTH_ADMIN',
  'android.permission.ACCESS_FINE_LOCATION',
]);

/**
 * Memperketat AndroidManifest.xml sesuai prinsip least-privilege:
 * - Membatasi izin legacy Bluetooth & lokasi hanya untuk Android <= 11 (maxSdkVersion="30")
 * - Menandai BLUETOOTH_SCAN dengan usesPermissionFlags="neverForLocation" untuk Android 12+
 */
function withAndroidSecurityHardening(config) {
  return withAndroidManifest(config, (modConfig) => {
    const manifest = modConfig.modResults.manifest;
    const permissions = manifest['uses-permission'] ?? [];

    for (const perm of permissions) {
      const attrs = perm.$;
      if (!attrs) continue;
      const name = attrs['android:name'];

      if (LEGACY_MAX_SDK_30_PERMISSIONS.has(name)) {
        attrs['android:maxSdkVersion'] = '30';
      }

      if (name === 'android.permission.BLUETOOTH_SCAN') {
        attrs['android:usesPermissionFlags'] = 'neverForLocation';
      }
    }

    return modConfig;
  });
}

module.exports = withAndroidSecurityHardening;
