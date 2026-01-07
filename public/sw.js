// Service Worker for handling push notifications
// Supports iOS Safari, Android Chrome, and other major browsers

const CACHE_NAME = 'xmobile-notifications-v1';
const NOTIFICATION_ICON = '/xm-logo.png';
const NOTIFICATION_BADGE = '/xm-logo.png';

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

// Handle push notifications
self.addEventListener('push', (event) => {
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

  event.waitUntil(
    clients
      .matchAll({
        type: 'window',
        includeUncontrolled: true,
      })
      .then((clientList) => {
        // If there's an open window, focus it
        for (let i = 0; i < clientList.length; i += 1) {
          const client = clientList[i];
          if (client.url && 'focus' in client) {
            const url = '/';
            // TODO: uncomment after when /chat page is implemented
            // const url = sessionId ? `/chat?sessionId=${sessionId}` : '/';

            // Navigate to the correct page if needed
            if (client.url.includes('/chat') || !sessionId) {
              return client.focus();
            }
            // Try to navigate if supported (some browsers don't support navigate)
            if ('navigate' in client && typeof client.navigate === 'function') {
              return client.navigate(url).then(() => client.focus());
            }
            // Fallback: just focus the existing window
            return client.focus();
          }
        }
        // If no window is open, open a new one
        if (clients.openWindow) {
          const url = '/';
          // TODO: uncomment after when /chat page is implemented
          // const url = sessionId ? `/chat?sessionId=${sessionId}` : '/';
          return clients.openWindow(url);
        }
        return null;
      }),
  );
});

// Handle messages from the main thread
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SHOW_NOTIFICATION') {
    const { notification } = event.data;
    event.waitUntil(
      self.registration.showNotification(notification.title || 'New message', {
        body: notification.content || notification.body,
        icon: notification.icon || NOTIFICATION_ICON,
        badge: notification.badge || NOTIFICATION_BADGE,
        tag: notification.id || notification.tag,
        data: {
          sessionId: notification.sessionId,
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
