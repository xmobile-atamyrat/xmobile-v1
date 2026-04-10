# XMobile iOS App Guide

This document details the iOS-specific configuration, commands, and setup for the XMobile React Native application.
> **Note**: Full iOS support is slated for Phase 2, but the infrastructure is present.

## Getting Started

1. **Install Dependencies (CocoaPods)**:
   Since iOS uses CocoaPods for native dependencies, you must install them before building:
   ```bash
   cd ios
   bundle install
   bundle exec pod install
   cd ..
   ```
   *You must run `pod install` every time a new native dependency is added to the project.*

2. **Start Metro Bundler**:
   From the `mobile` directory, start the Metro dev server:
   ```bash
   yarn start
   ```

3. **Run in Development**:
   With Metro running, start the app on an iOS Simulator or connected device:
   ```bash
   yarn ios
   ```

## Building in Xcode

Alternatively, you can open the workspace file directly in Xcode:
1. Open Xcode.
2. Select **Open a project or file**.
3. Choose `mobile/ios/XMobile.xcworkspace` (Make sure it is `.xcworkspace` and not `.xcodeproj`).
4. Select your target device/simulator and press **Run** (CMD + R).
