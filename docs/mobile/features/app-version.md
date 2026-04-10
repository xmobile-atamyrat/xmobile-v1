# App Version Management

The mobile app includes version checking to ensure that the embedded WebView is properly synchronized with natively cached assets and provides a way for the web application to enforce minimum version requirements.

## Implementation Details (`WebAppScreen.tsx`)

1. **Version Detection**: 
   Uses `react-native-device-info` (`DeviceInfo.getVersion()`) to get the current native app version.
   
2. **WebView Initialization**:
   When the app launches, it compares the current `DeviceInfo.getVersion()` with the previously stored `APP_VERSION` in `AsyncStorage`. 
   If they differ (indicating an app update), the WebView is forcibly reloaded (`webViewRef.current.reload()`) to clear out any stale web cache and the new version is persisted.

3. **Web-to-Native Communication**:
   The web application requests the native app's version by sending a `REQUEST_APP_VERSION` message.
   The native side responds by emitting an `APP_VERSION` window event, injecting the current semantic version string back into the web context.
