const fs = require('fs');
const path = require('path');
const { withDangerousMod } = require('expo/config-plugins');

/**
 * Patches legacy react-native-thermal-receipt-printer-image-qr Android Gradle config
 * for AGP 8+ compatibility (Expo SDK 53+): adds namespace, uses rootProject SDK versions,
 * and removes deprecated package attribute from AndroidManifest.xml.
 */
function withThermalPrinterFix(config) {
  return withDangerousMod(config, [
    'android',
    async (modConfig) => {
      const projectRoot = modConfig.modRequest.projectRoot;
      const libAndroidDir = path.join(
        projectRoot,
        'node_modules',
        'react-native-thermal-receipt-printer-image-qr',
        'android',
      );

      const gradlePath = path.join(libAndroidDir, 'build.gradle');
      if (fs.existsSync(gradlePath)) {
        let gradle = fs.readFileSync(gradlePath, 'utf8');
        if (!gradle.includes('namespace ')) {
          gradle = gradle.replace(
            /android\s*\{/,
            'android {\n    namespace "com.pinmi.react.printer"',
          );
        }
        gradle = gradle.replace(
          /compileSdkVersion\s*=?\s*\d+/,
          'compileSdkVersion rootProject.ext.compileSdkVersion',
        );
        gradle = gradle.replace(
          /buildToolsVersion\s*=?\s*["'][^"']+["']/,
          'buildToolsVersion rootProject.ext.buildToolsVersion',
        );
        gradle = gradle.replace(
          /targetSdkVersion\s*=?\s*\d+/,
          'targetSdkVersion rootProject.ext.targetSdkVersion',
        );
        gradle = gradle.replace(
          /minSdkVersion\s*=?\s*\d+/,
          'minSdkVersion rootProject.ext.minSdkVersion',
        );
        fs.writeFileSync(gradlePath, gradle, 'utf8');
      }

      const manifestPath = path.join(
        libAndroidDir,
        'src',
        'main',
        'AndroidManifest.xml',
      );
      if (fs.existsSync(manifestPath)) {
        let manifest = fs.readFileSync(manifestPath, 'utf8');
        manifest = manifest.replace(/\s*package="com\.pinmi\.react\.printer"/, '');
        fs.writeFileSync(manifestPath, manifest, 'utf8');
      }

      return modConfig;
    },
  ]);
}

module.exports = withThermalPrinterFix;
