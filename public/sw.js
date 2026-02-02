// Service Worker for handling push notifications and Offline Caching
// Supports iOS Safari, Android Chrome, and other major browsers
// Also handles Firebase Cloud Messaging (FCM) background messages

// Import Firebase Messaging scripts
importScripts(
  'https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js',
);
importScripts(
  'https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js',
);

const CACHE_NAME = 'xmobile-v4-cache'; // Bumped version for new paths
const STATIC_ASSETS = [
  '/logo/xm-logo.png', // Moved to logo folder
  '/manifest.json',
  '/logo/xm-logo.ico', // Moved to logo folder
];

// Use absolute URL for notification icons (required for mobile)
// Get the origin from the registration scope
const getNotificationIcon = () => {
  try {
    // Try to get origin from registration scope or location
    const origin =
      (self.registration && self.registration.scope
        ? new URL(self.registration.scope).origin
        : null) || self.location.origin;
    return `${origin}/logo/xm-logo.png`; // Update path here too
  } catch (e) {
    // Fallback to relative path if origin can't be determined
    return '/logo/xm-logo.png';
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
    // Note: If you have a specific badge icon in /logo/, use that.
    // Falling back to main logo for now as I didn't see a specific badge in the list.
    return `${origin}/logo/xm-logo.png`;
  } catch (e) {
    // Fallback: use main icon if badge icon doesn't exist
    return getNotificationIcon();
  }
};
const NOTIFICATION_ICON = getNotificationIcon();
const NOTIFICATION_BADGE = getBadgeIcon();

// Install event - Pre-cache critical static assets (Robust Version)
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      // console.log('[sw.js] Pre-caching static assets');

      // robustness: try caching each one individually so one failure doesn't break all
      for (const asset of STATIC_ASSETS) {
        try {
          await cache.add(asset);
        } catch (err) {
          console.warn(`[sw.js] Failed to cache ${asset}:`, err);
        }
      }
    }),
  );
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

// --------------------------------------------------------------------------
// CACHING STRATEGY (The "Pro" feature for speed)
// --------------------------------------------------------------------------
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // 1. Ignore non-GET requests (POST, PUT, DELETE, etc.)
  if (event.request.method !== 'GET') return;

  // 2. Ignore chrome-extension schemes and other non-http protocols
  if (!url.protocol.startsWith('http')) return;

  // 3. Ignore API calls (Network First / No Cache ideally, but we'll use Network First)
  // We want real-time data for APIs.
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/ws/')) {
    return; // Let the browser handle it (Network only)
  }

  // 4a. STRATEGY: Stale-While-Revalidate for JS, CSS, Images, Fonts
  // serve cache immediately, then update cache in background.
  if (
    url.pathname.match(
      /\.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$/,
    ) ||
    url.pathname.startsWith('/_next/static/')
  ) {
    event.respondWith(
      caches.open(CACHE_NAME).then((cache) => {
        return cache.match(event.request).then((cachedResponse) => {
          const fetchPromise = fetch(event.request)
            .then((networkResponse) => {
              // If valid response, update cache
              if (networkResponse.ok) {
                cache.put(event.request, networkResponse.clone());
              }
              return networkResponse;
            })
            .catch((err) => {
              // Network failed, nothing to do
            });

          // Return cached response if available, otherwise wait for network
          return cachedResponse || fetchPromise;
        });
      }),
    );
    return;
  }

  // 4b. STRATEGY: Stale-While-Revalidate for Next.js Data (/_next/data/)
  // This enables offline navigation within the app (SPA transitions)
  if (url.pathname.startsWith('/_next/data/')) {
    event.respondWith(
      caches.open(CACHE_NAME).then((cache) => {
        return cache.match(event.request).then((cachedResponse) => {
          const fetchPromise = fetch(event.request)
            .then((networkResponse) => {
              if (networkResponse.ok) {
                cache.put(event.request, networkResponse.clone());
              }
              return networkResponse;
            })
            .catch((err) => {
              // Network failed
            });
          return cachedResponse || fetchPromise;
        });
      }),
    );
    return;
  }

  // 5. STRATEGY: Network First for HTML (Pages)
  // Try network, if fails (offline), try cache
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          // Clone and cache the updated HTML page
          const resClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, resClone);
          });
          return response;
        })
        .catch(() => {
          // If offline, serve cached page
          return caches.match(event.request);
        }),
    );
  }
});

// --------------------------------------------------------------------------
// FIREBASE & NOTIFICATION LOGIC (Preserved from original)
// --------------------------------------------------------------------------

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
      messagingInstance.onBackgroundMessage((payload) => {
        console.log('[sw.js] Received FCM background message:', payload);

        // Check if app is in foreground by checking for active clients
        self.clients
          .matchAll({ type: 'window', includeUncontrolled: true })
          .then((clientList) => {
            if (clientList.length > 0) {
              // App is open, send message to main thread for foreground handling
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
self.addEventListener('push', (event) => {
  // Check if this is an FCM message
  if (event.data) {
    try {
      const data = event.data.json();
      // If it has FCM-specific fields, it's an FCM message
      if (data.from || data.messageId) {
        // If Firebase is initialized, onBackgroundMessage should handle it
        if (firebaseInitialized && messagingInstance) {
          return;
        } else {
          // Firebase not initialized yet
          if (firebaseConfig) {
            initializeFirebaseMessaging();
            pendingPushEvents.push(event);
            return;
          }
        }
      }
    } catch (e) {
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
      vibrate: [200, 100, 200],
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
self.addEventListener('message', (event) => {
  // Handle manual show notification request
  if (event.data && event.data.type === 'SHOW_NOTIFICATION') {
    const { notification } = event.data;
    const notificationId =
      notification.id || notification.tag || 'notification';

    event.waitUntil(
      self.registration.showNotification(notification.title || 'New message', {
        body: notification.content || notification.body,
        icon: notification.icon || NOTIFICATION_ICON,
        badge: notification.badge || NOTIFICATION_BADGE,
        tag: notificationId,
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
