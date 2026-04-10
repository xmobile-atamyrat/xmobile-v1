# Authentication & Token Storage

Since the mobile application relies heavily on rendering the web platform inside a WebView, authentication states (JWT refresh tokens) must be seamlessly shared between native storage and the web context.

## Implementation Details (`WebAppScreen.tsx`)

### Secure Storage
Authentication data is persisted on the native side using `@react-native-async-storage/async-storage`:
- `REFRESH_TOKEN`: The JWT refresh token used for session recovery.
- `NEXT_LOCALE`: The user's active locale/language choice.

### Web-to-Native Sync
When a user logs in, logs out, or changes their language on the web platform, the WebView dispatches messages:
- `AUTH_STATE`: Updates to `REFRESH_TOKEN` and `NEXT_LOCALE` are caught and written to `AsyncStorage`.
- `LOGOUT`: Triggers complete clearance of `AsyncStorage` (removes the `REFRESH_TOKEN`, `FCM_TOKEN_CACHE`, `NEXT_LOCALE`) and deletes cookies via `@react-native-cookies/cookies`.

### Native-to-Web Session Injection
Upon launching the app, the native wrapper preemptively reads `AsyncStorage`. It uses the `injectedJavaScriptBeforeContentLoaded` property of the `WebView` to execute raw JavaScript that manually sets the `document.cookie` with the stored `REFRESH_TOKEN` and `NEXT_LOCALE`.
This guarantees that when the web page makes its very first request, it does so as an authenticated user, hiding the hybrid nature of the app.
