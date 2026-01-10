/* eslint-disable no-restricted-globals */
/* eslint-disable no-undef */
// Firebase Messaging Service Worker
// This handles FCM background messages when the app is not in foreground

importScripts(
  'https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js',
);
importScripts(
  'https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js',
);

// Firebase configuration
// These values can be overridden by environment variables in the main app
// For service worker, we use the same defaults as the main app
const firebaseConfig = {
  apiKey:
    'AIzaSyB6uDU2Mwzj-pbl1EEs2iOTvKHbznRurYI' ||
    self.location.searchParams.get('apiKey'),
  authDomain:
    'xmobile-54bc9.firebaseapp.com' ||
    self.location.searchParams.get('authDomain'),
  projectId: 'xmobile-54bc9' || self.location.searchParams.get('projectId'),
  storageBucket:
    'xmobile-54bc9.firebasestorage.app' ||
    self.location.searchParams.get('storageBucket'),
  messagingSenderId:
    '872118016510' || self.location.searchParams.get('messagingSenderId'),
  appId:
    '1:872118016510:web:fe45e3367c39bceecf08af' ||
    self.location.searchParams.get('appId'),
  measurementId:
    'G-0FBC3LXD1Z' || self.location.searchParams.get('measurementId'),
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const messaging = firebase.messaging();

// Get notification icon and badge
const getNotificationIcon = () => {
  try {
    const origin =
      (self.registration && self.registration.scope
        ? new URL(self.registration.scope).origin
        : null) || self.location.origin;
    return `${origin}/xm-logo.png`;
  } catch (e) {
    return '/xm-logo.png';
  }
};

const getBadgeIcon = () => {
  try {
    const origin =
      (self.registration && self.registration.scope
        ? new URL(self.registration.scope).origin
        : null) || self.location.origin;
    return `${origin}/xm-logo-badge.png` || getNotificationIcon();
  } catch (e) {
    return getNotificationIcon();
  }
};

const NOTIFICATION_ICON = getNotificationIcon();
const NOTIFICATION_BADGE = getBadgeIcon();

// Handle background messages from FCM
messaging.onBackgroundMessage((payload) => {
  console.log(
    '[firebase-messaging-sw.js] Received background message:',
    payload,
  );

  const notificationTitle =
    payload.notification?.title || payload.data?.title || 'Уведомление';
  const notificationBody =
    payload.notification?.body ||
    payload.data?.body ||
    payload.data?.content ||
    'Новое уведомление';

  // Extract data for deep linking
  const notificationData = {
    notificationId: payload.data?.notificationId || payload.data?.id,
    type: payload.data?.type,
    sessionId: payload.data?.sessionId,
    orderId: payload.data?.orderId,
    click_action: payload.data?.click_action,
    ...payload.data,
  };

  // Show notification
  const notificationOptions = {
    body: notificationBody,
    icon: payload.notification?.icon || NOTIFICATION_ICON,
    badge: payload.notification?.badge || NOTIFICATION_BADGE,
    tag: notificationData.notificationId || 'fcm-notification',
    data: notificationData,
    requireInteraction: false,
    silent: false,
    vibrate: [200, 100, 200], // Vibration pattern for mobile
  };

  return self.registration.showNotification(
    notificationTitle,
    notificationOptions,
  );
});

// Handle notification clicks
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const notificationData = event.notification.data || {};
  const sessionId = notificationData.sessionId;
  const orderId = notificationData.orderId;
  const clickAction = notificationData.click_action;

  event.waitUntil(
    clients
      .matchAll({
        type: 'window',
        includeUncontrolled: true,
      })
      .then((clientList) => {
        // Determine the URL to navigate to
        let url = '/';
        if (clickAction) {
          // Use click_action from FCM payload if available
          try {
            const urlObj = new URL(clickAction);
            url = urlObj.pathname + urlObj.search;
          } catch (e) {
            url = clickAction.startsWith('/') ? clickAction : `/${clickAction}`;
          }
        } else if (orderId) {
          url = `/orders/${orderId}`;
        } else if (sessionId) {
          url = `/chat?sessionId=${sessionId}`;
        }

        // If there's an open window, focus it and navigate if needed
        for (let i = 0; i < clientList.length; i += 1) {
          const client = clientList[i];
          if (client.url && 'focus' in client) {
            // Check if we need to navigate to a different page
            const needsNavigation =
              (orderId && !client.url.includes(`/orders/${orderId}`)) ||
              (sessionId &&
                !orderId &&
                !client.url.includes(`/chat?sessionId=${sessionId}`));

            if (needsNavigation) {
              // Try to navigate if supported
              if (
                'navigate' in client &&
                typeof client.navigate === 'function'
              ) {
                return client.navigate(url).then(() => client.focus());
              }
              // Fallback: just focus the existing window
              return client.focus();
            }
            // Already on the correct page, just focus
            return client.focus();
          }
        }
        // If no window is open, open a new one
        if (clients.openWindow) {
          return clients.openWindow(url);
        }
        return null;
      }),
  );
});
