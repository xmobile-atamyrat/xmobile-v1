// Service Worker for handling push notifications
// Supports iOS Safari, Android Chrome, and other major browsers
// Also handles Firebase Cloud Messaging (FCM) background messages

// Import Firebase Messaging scripts
importScripts(
  'https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js',
);
importScripts(
  'https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js',
);

const CACHE_NAME = 'xmobile-notifications-v1';
// Use absolute URL for notification icons (required for mobile)
// Get the origin from the registration scope
const getNotificationIcon = () => {
  try {
    // Try to get origin from registration scope or location
    const origin =
      (self.registration && self.registration.scope
        ? new URL(self.registration.scope).origin
        : null) || self.location.origin;
    return `${origin}/xm-logo.png`;
  } catch (e) {
    // Fallback to relative path if origin can't be determined
    return '/xm-logo.png';
  }
};
// Badge icon for status bar - needs to be monochrome (white/transparent)
// For now, use the same icon but ideally should be a simplified monochrome version
const getBadgeIcon = () => {
  try {
    const origin =
      (self.registration && self.registration.scope
        ? new URL(self.registration.scope).origin
        : null) || self.location.origin;
    // Try to use a simplified badge icon, fallback to main icon
    return `${origin}/xm-logo-badge.png`;
  } catch (e) {
    // Fallback: use main icon if badge icon doesn't exist
    return getNotificationIcon();
  }
};
const NOTIFICATION_ICON = getNotificationIcon();
const NOTIFICATION_BADGE = getBadgeIcon();

// Install event - cache resources
self.addEventListener('install', (event) => {
  self.skipWaiting(); // Activate immediately
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name)),
      );
    }),
  );
  return self.clients.claim(); // Take control of all pages immediately
});

// Initialize Firebase for FCM
// Config will be received from main thread via postMessage
let firebaseInitialized = false;
let firebaseConfig = null;
let messagingInstance = null;

// Listen for Firebase config from main thread
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'FIREBASE_CONFIG') {
    firebaseConfig = event.data.config;
    initializeFirebaseMessaging();
  }
});

// Store push events that arrive before Firebase is initialized
let pendingPushEvents = [];

// Process pending push events after Firebase is initialized
function processPendingPushEvents() {
  if (pendingPushEvents.length > 0 && firebaseInitialized) {
    console.log(
      `[sw.js] Processing ${pendingPushEvents.length} pending push events`,
    );
    pendingPushEvents.forEach((event) => {
      // These will be handled by onBackgroundMessage if it's set up
      // Otherwise they'll fall through to the push event handler
    });
    pendingPushEvents = [];
  }
}

function initializeFirebaseMessaging() {
  if (firebaseInitialized || !firebaseConfig) {
    return;
  }

  try {
    if (typeof firebase !== 'undefined' && firebaseConfig) {
      // Check if app already exists
      let app;
      try {
        app = firebase.app();
      } catch (e) {
        // App doesn't exist, initialize it
        app = firebase.initializeApp(firebaseConfig);
      }

      messagingInstance = firebase.messaging();

      // Handle FCM background messages
      // This fires when app is in background/closed
      // NOTE: Some browsers (like Yandex) may route messages here even in foreground
      // So we also notify the main thread for foreground handling
      messagingInstance.onBackgroundMessage((payload) => {
        console.log('[sw.js] Received FCM background message:', payload);

        // Check if app is in foreground by checking for active clients
        // If in foreground, also send message to main thread for onMessage handler
        self.clients
          .matchAll({ type: 'window', includeUncontrolled: true })
          .then((clientList) => {
            if (clientList.length > 0) {
              // App is open, send message to main thread for foreground handling
              console.log(
                '[sw.js] App is in foreground, notifying main thread',
              );
              clientList.forEach((client) => {
                if (client && 'postMessage' in client) {
                  client.postMessage({
                    type: 'FCM_FOREGROUND_MESSAGE',
                    payload: payload,
                  });
                }
              });
            }
          })
          .catch((error) => {
            console.warn('[sw.js] Failed to check clients:', error);
          });

        const notificationTitle =
          payload.notification?.title || payload.data?.title || 'Уведомление';
        const notificationBody =
          payload.notification?.body ||
          payload.data?.body ||
          payload.data?.content ||
          'Новое уведомление';

        const notificationId =
          payload.data?.notificationId ||
          payload.data?.id ||
          'fcm-notification';
        const notificationData = {
          notificationId,
          type: payload.data?.type,
          sessionId: payload.data?.sessionId,
          orderId: payload.data?.orderId,
          click_action: payload.data?.click_action,
          ...payload.data,
        };

        // Use notificationId as tag to prevent duplicate notifications
        return self.registration.showNotification(notificationTitle, {
          body: notificationBody,
          icon: payload.notification?.icon || NOTIFICATION_ICON,
          badge: payload.notification?.badge || NOTIFICATION_BADGE,
          tag: notificationId, // Use notification ID as tag to prevent duplicates
          data: notificationData,
          requireInteraction: false,
          silent: false,
          vibrate: [200, 100, 200],
        });
      });

      firebaseInitialized = true;
      console.log('[sw.js] Firebase Messaging initialized successfully');

      // Process any pending push events
      processPendingPushEvents();
    }
  } catch (error) {
    console.error('[sw.js] Failed to initialize Firebase:', error);
    firebaseInitialized = false;
  }
}

// Handle push notifications (legacy/fallback)
// NOTE: This should NOT fire for FCM messages - FCM uses onBackgroundMessage
// This is only for non-FCM push notifications
self.addEventListener('push', (event) => {
  // Check if this is an FCM message
  if (event.data) {
    try {
      const data = event.data.json();
      // If it has FCM-specific fields, it's an FCM message
      if (data.from || data.messageId) {
        // If Firebase is initialized, onBackgroundMessage should handle it
        if (firebaseInitialized && messagingInstance) {
          console.log(
            '[sw.js] FCM message detected, onBackgroundMessage should handle it',
          );
          // Don't return - let onBackgroundMessage handle it
          // But also don't fall through to legacy handler
          return;
        } else {
          // Firebase not initialized yet
          console.log(
            '[sw.js] FCM message detected but Firebase not initialized yet',
          );
          if (firebaseConfig) {
            // Try to initialize
            initializeFirebaseMessaging();
            // Store the event to process after initialization
            pendingPushEvents.push(event);
            return;
          } else {
            // No config yet - this shouldn't happen, but handle gracefully
            console.warn(
              '[sw.js] FCM message received but no Firebase config available',
            );
            // Fall through to show a basic notification
          }
        }
      }
    } catch (e) {
      // Not JSON or can't parse, continue with legacy handling
      console.log('[sw.js] Push event data is not JSON, handling as legacy');
    }
  }

  let notificationData = {
    title: 'New message',
    body: 'You have a new notification',
    icon: NOTIFICATION_ICON,
    badge: NOTIFICATION_BADGE,
    tag: 'notification',
    data: {},
  };

  if (event.data) {
    try {
      const data = event.data.json();
      notificationData = {
        title: data.title || notificationData.title,
        body: data.body || data.content || notificationData.body,
        icon: data.icon || NOTIFICATION_ICON,
        badge: data.badge || NOTIFICATION_BADGE,
        tag: data.tag || data.id || notificationData.tag,
        data: data.data || {},
        requireInteraction: data.requireInteraction || false,
        silent: data.silent || false,
      };
    } catch (e) {
      // If data is text, use it as body
      notificationData.body = event.data.text() || notificationData.body;
    }
  }

  event.waitUntil(
    self.registration.showNotification(notificationData.title, {
      body: notificationData.body,
      icon: notificationData.icon,
      badge: notificationData.badge,
      tag: notificationData.tag,
      data: notificationData.data,
      requireInteraction: notificationData.requireInteraction,
      silent: notificationData.silent,
      vibrate: [200, 100, 200], // Vibration pattern for mobile
    }),
  );
});

// Handle notification clicks
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const notificationData = event.notification.data || {};
  const sessionId = notificationData.sessionId;
  const orderId = notificationData.orderId;

  event.waitUntil(
    clients
      .matchAll({
        type: 'window',
        includeUncontrolled: true,
      })
      .then((clientList) => {
        // Determine the URL to navigate to based on notification type
        let url = '/';
        if (orderId) {
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
              // Try to navigate if supported (some browsers don't support navigate)
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

// Handle messages from the main thread
// This is used for WebSocket notifications (fallback when FCM is not available)
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SHOW_NOTIFICATION') {
    const { notification } = event.data;
    const notificationId =
      notification.id || notification.tag || 'notification';

    // Use notification ID as tag to prevent duplicates
    event.waitUntil(
      self.registration.showNotification(notification.title || 'New message', {
        body: notification.content || notification.body,
        icon: notification.icon || NOTIFICATION_ICON,
        badge: notification.badge || NOTIFICATION_BADGE,
        tag: notificationId, // Use ID as tag to prevent duplicates
        data: {
          sessionId: notification.sessionId,
          orderId: notification.orderId,
          notificationId: notification.id,
          ...notification.data,
        },
        requireInteraction: false,
        silent: false,
        vibrate: [200, 100, 200],
      }),
    );
  }
});
