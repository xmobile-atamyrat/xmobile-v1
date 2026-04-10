# Push Notifications (FCM)

The react-native wrapper handles deep integration with Firebase Cloud Messaging (FCM) to provide rich, native push notifications to developers and users.

## Implementation Details (`WebAppScreen.tsx`)

### Permissions
For Android 13+ (API 33+), the app explicitly checks and requests the `POST_NOTIFICATIONS` runtime permission. Results of these permission checks are communicated back to the web context.

### Token Management
1. **Fetching**: Once permissions are granted, `messaging().getToken()` fetches the device's FCM token.
2. **Caching**: This token is stored in `AsyncStorage` under `FCM_TOKEN_CACHE` to avoid redundant fetching.
3. **Web Sync**: The native side injects an `FCM_TOKEN_AVAILABLE` script into the web context to deliver the token alongside a unique device ID (`DeviceInfo.getUniqueId()`). The web backend uses this to link the device to the User context.

### Foreground Notifications
If a notification arrives while the user has the app open:
- An internal Queue (`notificationQueue`) handles multiple simultaneous notifications.
- A custom, non-obstructive banner UI is rendered directly via React Native (so it overlays the WebView).

### Deep Linking & Navigation
Native code detects when a user taps a notification (via `onNotificationOpenedApp` or `getInitialNotification`). It interprets structured data payloads:
- `click_action`: Direct route path.
- `orderId`: Navigates to `/orders/[id]`.
- `sessionId`: Navigates to `/chat?sessionId=[id]`.
To execute the navigation, the native wrapper uses `webViewRef...injectJavaScript` to dispatch a `NOTIFICATION_CLICK` event, which the Next.js router intercepts to push the route securely.
