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

> The **Android Play Store upload** GitHub Actions workflow (below) overrides `versionCode`/`versionName` automatically for every release it builds — `versionCode` is the workflow run number, `versionName` is whatever you type into the `android_version_name` input. You only need to hand-edit `build.gradle` for local/manual builds.

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

## GitHub Actions: manual Play Store upload

The workflow **Android Play Store upload** (`.github/workflows/android-playstore-release.yml`) runs **only** from **Actions → Run workflow**. It does not run on push or PR.

It uses two jobs: **Build AAB** (assemble + sign a release `.aab` via Gradle) and **Upload to Play Console** ([`r0adkll/upload-google-play`](https://github.com/r0adkll/upload-google-play)). You pick the `android_version_name` (e.g. `1.0.2`) and the `android_track` (`internal` / `alpha` / `beta` / `production`) when triggering; `versionCode` is set automatically to the GitHub Actions run number so it always increases.

If **upload** fails but **build** succeeded, open that workflow run → **Re-run failed jobs** to retry only the upload (GitHub keeps the AAB artifact from the successful build for that run).

**Prerequisite:** In [Google Play Console](https://play.google.com/console), create an app with package name **`com.xmobile.app`** and complete the minimum store listing/content-rating info before the first upload — the Play Developer API can add releases to an existing app but can't create the app itself.

**Release keystore:** Generate once and keep it safe forever (losing it means you can never update the published app again):
```bash
keytool -genkeypair -v -keystore release.keystore -alias xmobile-release -keyalg RSA -keysize 2048 -validity 10000
```

**Service account:** In Google Cloud Console, create a service account, then link it under Play Console → **Setup → API access**, and grant it release-manager permissions. Download its JSON key — that's the `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON` secret below.

### Optional: require approval before the job runs

The job uses GitHub Environment **`android-playstore-release`**. To require another maintainer to approve before secrets are exposed to the runner: **Settings → Environments → New environment**, name it **`android-playstore-release`** (must match exactly), then enable **Required reviewers** under **Deployment protection rules**.

### Repository or environment secrets (Settings → Secrets and variables → Actions)

Create these secrets as **repository** secrets **or** under the **`android-playstore-release`** environment — **same names**.

| Secret                                | What it is                                                                                                    |
| -------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `ANDROID_KEYSTORE_BASE64`              | **Base64** of your `release.keystore` file: `base64 -i release.keystore \| pbcopy` (macOS) or `base64 -w0 release.keystore` (Linux). |
| `ANDROID_KEYSTORE_PASSWORD`            | The keystore password you set with `keytool`.                                                                  |
| `ANDROID_KEY_ALIAS`                    | The key alias you set with `keytool` (e.g. `xmobile-release`).                                                 |
| `ANDROID_KEY_PASSWORD`                 | The key password you set with `keytool` (often the same as the keystore password).                            |
| `ANDROID_GOOGLESERVICES_JSON_BASE64`   | **Base64** of your real `android/app/google-services.json` (this file is not committed to the repo).          |
| `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON`     | The full JSON key downloaded for the service account above. Paste the whole file as the secret value.         |

### Run the workflow

**Actions** → **Android Play Store upload** → **Run workflow**, fill in `android_version_name` and pick `android_track` (start with `internal`).
