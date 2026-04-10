# Offline Mode & Connectivity

The mobile application tracks device connectivity status directly on the native host layer, rather than relying solely on the web context's navigator object.

## Implementation Details (`WebAppScreen.tsx`)

### Detection
The app uses `@react-native-community/netinfo` to actively monitor `isConnected` and `isInternetReachable`.

### Interruption Handling
If internet connectivity drops, the native code immediately hides the WebView and displays a rich native Offline Screen ("Baglanyşyk Kesildi"). 

### Recovery (`Retry`)
Users can interact with a native retry button. Attempting a retry forces `NetInfo.fetch()` to aggressively re-check the connection. If the connection is restored, the `hasWebviewError` flag unmounts the offline UI and attempts to resume the web view rendering.
