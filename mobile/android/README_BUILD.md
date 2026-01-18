# Android Build Configuration

## Node.js PATH Issue

When building from Android Studio, you may encounter an error:
```
A problem occurred starting process 'command 'npx'
```

This happens because Android Studio doesn't have Node.js in its PATH.

## Solution: Configure Android Studio Environment

### Option 1: Set PATH in Android Studio (Recommended)

1. Open Android Studio
2. Go to **Android Studio → Settings** (macOS) or **File → Settings** (Windows/Linux)
3. Navigate to **Build, Execution, Deployment → Build Tools → Gradle**
4. Under **Gradle JDK**, ensure you have Java 17 selected
5. In the same section, look for **Environment variables** or create a `gradle.properties` entry
6. Add the following to your `~/.gradle/gradle.properties` (or project's `gradle.properties`):
   ```
   org.gradle.project.PATH=/opt/homebrew/bin:${System.getenv("PATH")}
   ```

### Option 2: Configure Android Studio's Shell Environment

1. Open Android Studio
2. Go to **Android Studio → Settings → Tools → Terminal**
3. Set **Shell path** to use a shell that has Node.js in PATH (e.g., `/bin/zsh` with proper `.zshrc` configuration)

### Option 3: Build from Command Line

Build from terminal where Node.js is available:

```bash
cd mobile/android
export JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home"
export PATH="/opt/homebrew/bin:$PATH"
./gradlew assembleDebug
```

## Current Configuration

- **Gradle Version**: 8.10.2
- **Node.js Path**: `/opt/homebrew/bin/node`
- **npx Path**: `/opt/homebrew/bin/npx`
- **Java**: Android Studio's bundled JDK

## Build Commands

From the `mobile/` directory:
- `npm run android:build:debug` - Build debug APK
- `npm run android:build:release` - Build release APK
- `npm run android:build:aab` - Build AAB for Play Store

Or directly with gradlew:
```bash
cd mobile/android
./gradlew assembleDebug
./gradlew assembleRelease
./gradlew bundleRelease
```
