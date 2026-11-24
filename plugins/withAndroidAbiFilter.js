const { withGradleProperties } = require('expo/config-plugins');

/**
 * Membatasi arsitektur native Android hanya ke perangkat HP fisik
 * (arm64-v8a untuk HP modern 64-bit + armeabi-v7a untuk HP lama 32-bit),
 * membuang x86 & x86_64 (emulator PC) agar ukuran APK jauh lebih kecil.
 */
function withAndroidAbiFilter(config) {
  return withGradleProperties(config, (modConfig) => {
    const props = modConfig.modResults;
    const key = 'reactNativeArchitectures';
    const value = 'armeabi-v7a,arm64-v8a';

    const existing = props.find((item) => item.type === 'property' && item.key === key);
    if (existing) {
      existing.value = value;
    } else {
      props.push({ type: 'property', key, value });
    }

    return modConfig;
  });
}

module.exports = withAndroidAbiFilter;
