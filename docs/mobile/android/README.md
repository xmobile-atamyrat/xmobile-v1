# XMobile Android App Guide

This document details the Android-specific configuration, commands, and architecture for the XMobile React Native application.

## Overview
- **Package Name**: `com.xmobile.app`
- **Display Name**: XMobile

## Getting Started

1. **Start Metro Bundler**:
   From the `mobile` directory, run:
   ```bash
   yarn start
   ```

2. **Run in Development**:
   With Metro running, start the app on an Android emulator or connected device:
   ```bash
   yarn android:dev
   # OR
   yarn android
   ```

## Production Builds

You can build the Android APK or AAB files using gradlew commands directly or via package scripts.

### Generating an APK
- **Debug APK**: `yarn android:build:debug` or `cd android && ./gradlew assembleDebug`
- **Release APK**: `yarn android:build:release` or `cd android && ./gradlew assembleRelease`

### Generating an AAB (For Google Play Store)
- **Build AAB**: `yarn android:build:aab` or `cd android && ./gradlew bundleRelease`

### Output Locations
- **Debug APK**: `android/app/build/outputs/apk/debug/app-debug.apk`
- **Release APK**: `android/app/build/outputs/apk/release/app-release.apk`
- **Release AAB**: `android/app/build/outputs/bundle/release/app-release.aab`

## Changing App Version

To update the Android app version (which triggers the web-side `APP_VERSION` check and cache reload):

1. Open `mobile/android/app/build.gradle`.
2. Locate the `defaultConfig` block.
3. Update the following fields:
   *   **`versionCode`**: An integer used as an internal version number. This **must** be incremented by at least 1 for every new release submitted to the Google Play Store. (e.g., `2` to `3`)
   *   **`versionName`**: The string shown to users. This should follow semantic versioning. (e.g., `"1.0.0"` to `"1.0.1"`)

```gradle
defaultConfig {
    applicationId "com.xmobile.app"
    minSdkVersion rootProject.ext.minSdkVersion
    targetSdkVersion rootProject.ext.targetSdkVersion
    versionCode 3      // Increment this!
    versionName "1.0.1" // Update this string!
}
```

## Troubleshooting & Cleaning
If you run into cache or dependency issues during Android builds:
```bash
yarn android:clean
# OR
cd android && ./gradlew clean
```
