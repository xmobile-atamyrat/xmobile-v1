# XMobile React Native App

This directory contains documentation for the React Native mobile app (`mobile`). 
The app wraps the Next.js web application in a WebView (`react-native-webview`), providing a native mobile experience while leveraging the existing web UI and API.

## Structure
- [**Android Documentation**](./android/README.md): Detailed guide for building, running, and configuring the Android app.
- [**iOS Documentation**](./ios/README.md): Detailed guide for building, running, and configuring the iOS app.

## Features & Integrations
Detailed documentation regarding the native wrappers implementation of complex hybrid app features:
- [**Authentication**](./features/authentication.md): JWT sync across AsyncStorage and Web Cookies.
- [**Push Notifications**](./features/notifications.md): FCM Tokens, Foreground Banners, and Payload Deep Linking.
- [**App Versioning**](./features/app-version.md): Forced WebView cache clears and web-side version requirements.
- [**Offline Mode**](./features/offline-mode.md): Native UI block for loss of connectivity.

## General Architecture
- **Web App URL**: `http://[IP_ADDRESS]` (Configurable via environment variables/constants in the app)
- **Key Libraries**: `react-native-webview` (for rendering web content) and `react-native-safe-area-context` (for device notches/status bars).
