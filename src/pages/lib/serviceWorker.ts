// Service Worker registration and management
// Supports iOS Safari, Android Chrome, and other major browsers

export interface ServiceWorkerRegistrationState {
  registration: ServiceWorkerRegistration | null;
  isSupported: boolean;
  isReady: boolean;
}

let swRegistration: ServiceWorkerRegistration | null = null;
let registrationPromise: Promise<ServiceWorkerRegistration | null> | null =
  null;

/**
 * Detect if running in React Native WebView
 * WebView doesn't support Service Workers and has limited Notification API support
 */
export function isWebView(): boolean {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return false;
  }
  const ua = navigator.userAgent || '';
  // React Native WebView user agents typically contain these patterns
  return (
    /ReactNative/i.test(ua) ||
    /wv/i.test(ua) || // Android WebView
    /WebView/i.test(ua) || // iOS WebView
    typeof (window as any).ReactNativeWebView !== 'undefined' ||
    typeof (window as any).webkit?.messageHandlers !== 'undefined' // iOS WebView bridge
  );
}

/**
 * Check if Service Workers are supported
 * Excludes WebView environments where Service Workers don't work
 */
export function isServiceWorkerSupported(): boolean {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return false;
  }
  // Don't use Service Workers in WebView
  if (isWebView()) {
    return false;
  }
  return 'serviceWorker' in navigator && 'Notification' in window;
}

/**
 * Detect if running on mobile device
 */
export function isMobileDevice(): boolean {
  if (typeof window === 'undefined') return false;
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent,
  );
}

/**
 * Detect iOS Safari specifically
 */
export function isIOSSafari(): boolean {
  if (typeof window === 'undefined') return false;
  const ua = navigator.userAgent;
  const isIOS = /iPad|iPhone|iPod/.test(ua);
  const isSafari = /Safari/.test(ua) && !/CriOS|FxiOS|OPiOS/.test(ua);
  return isIOS && isSafari;
}

/**
 * Register Service Worker
 */
export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!isServiceWorkerSupported()) {
    console.warn('Service Workers are not supported in this browser');
    return null;
  }

  // Return existing registration if available
  if (swRegistration) {
    return swRegistration;
  }

  // Return existing promise if registration is in progress
  if (registrationPromise) {
    return registrationPromise;
  }

  registrationPromise = (async () => {
    try {
      const registration = await navigator.serviceWorker.register('/sw.js', {
        scope: '/',
      });

      // Wait for the service worker to be ready
      await navigator.serviceWorker.ready;

      swRegistration = registration;
      console.log('Service Worker registered successfully');

      // Handle updates
      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing;
        if (newWorker) {
          newWorker.addEventListener('statechange', () => {
            if (
              newWorker.state === 'installed' &&
              navigator.serviceWorker.controller
            ) {
              console.log('New Service Worker available');
              // Optionally notify user to refresh
            }
          });
        }
      });

      return registration;
    } catch (error) {
      console.error('Service Worker registration failed:', error);
      return null;
    } finally {
      registrationPromise = null;
    }
  })();

  return registrationPromise;
}

/**
 * Unregister Service Worker
 */
export async function unregisterServiceWorker(): Promise<boolean> {
  if (!isServiceWorkerSupported()) {
    return false;
  }

  try {
    const registration = await navigator.serviceWorker.ready;
    const result = await registration.unregister();
    if (result) {
      swRegistration = null;
      console.log('Service Worker unregistered');
    }
    return result;
  } catch (error) {
    console.error('Service Worker unregistration failed:', error);
    return false;
  }
}

/**
 * Get current Service Worker registration
 */
export function getServiceWorkerRegistration(): ServiceWorkerRegistration | null {
  return swRegistration;
}

/**
 * Show notification using Service Worker (preferred for mobile)
 */
export async function showNotificationViaServiceWorker(notification: {
  title?: string | null;
  content: string;
  id: string;
  sessionId?: string | null;
  orderId?: string | null;
  icon?: string;
  badge?: string;
}): Promise<boolean> {
  if (!isServiceWorkerSupported()) {
    return false;
  }

  try {
    let registration = swRegistration;
    if (!registration) {
      registration = await registerServiceWorker();
    }

    if (!registration) {
      return false;
    }

    // Wait for service worker to be ready
    await navigator.serviceWorker.ready;

    // Send message to service worker to show notification
    if (navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({
        type: 'SHOW_NOTIFICATION',
        notification: {
          title: notification.title || 'New message',
          content: notification.content,
          body: notification.content,
          id: notification.id,
          sessionId: notification.sessionId,
          orderId: notification.orderId,
          icon:
            notification.icon ||
            `${typeof window !== 'undefined' ? window.location.origin : ''}/logo/xm-logo.png`,
          badge:
            notification.badge ||
            `${typeof window !== 'undefined' ? window.location.origin : ''}/xm-logo-badge.png` ||
            `${typeof window !== 'undefined' ? window.location.origin : ''}/logo/xm-logo.png`,
          tag: notification.id,
          data: {
            sessionId: notification.sessionId,
            orderId: notification.orderId,
            notificationId: notification.id,
          },
        },
      });
      return true;
    }

    // Fallback: use ServiceWorkerRegistration.showNotification directly
    // Note: vibrate is a valid property for Service Worker notifications
    // but TypeScript types don't include it, so we use type assertion
    await registration.showNotification(notification.title || 'New message', {
      body: notification.content,
      icon: notification.icon || '/logo/xm-logo.png',
      badge: notification.badge || '/logo/xm-logo.png',
      tag: notification.id,
      data: {
        sessionId: notification.sessionId,
        orderId: notification.orderId,
        notificationId: notification.id,
      },
      requireInteraction: false,
      silent: false,
      vibrate: [200, 100, 200], // Vibration pattern for mobile
    } as NotificationOptions & { vibrate?: number[] });
    return true;
  } catch (error) {
    console.error('Failed to show notification via Service Worker:', error);
    return false;
  }
}

/**
 * Show notification using Notification API (fallback for desktop)
 */
export function showNotificationViaAPI(notification: {
  title?: string | null;
  content: string;
  id: string;
  sessionId?: string | null;
  orderId?: string | null;
  icon?: string;
  badge?: string;
}): boolean {
  if (
    typeof window === 'undefined' ||
    !('Notification' in window) ||
    Notification.permission !== 'granted'
  ) {
    return false;
  }

  try {
    const browserNotification = new Notification(
      notification.title || 'New message',
      {
        body: notification.content,
        icon:
          notification.icon ||
          `${typeof window !== 'undefined' ? window.location.origin : ''}/logo/xm-logo.png`,
        badge:
          notification.badge ||
          `${typeof window !== 'undefined' ? window.location.origin : ''}/logo/xm-logo.png`,
        tag: notification.id,
        data: {
          sessionId: notification.sessionId,
          orderId: notification.orderId,
          notificationId: notification.id,
        },
        requireInteraction: false,
        silent: false,
      },
    );

    // Handle notification click
    browserNotification.onclick = (event) => {
      event.preventDefault();
      window.focus();
      // Route based on notification type
      if (notification.orderId) {
        window.location.href = `/orders/${notification.orderId}`;
      } else if (notification.sessionId) {
        window.location.href = `/chat?sessionId=${notification.sessionId}`;
      } else {
        window.location.href = '/';
      }
      browserNotification.close();
    };

    // Auto-close after 5 seconds (only if app is in foreground)
    if (!document.hidden) {
      setTimeout(() => {
        browserNotification.close();
      }, 5000);
    }

    return true;
  } catch (error) {
    console.error('Failed to show browser notification:', error);
    return false;
  }
}

/**
 * Show notification with automatic method selection
 * Prefers Service Worker on mobile, falls back to Notification API
 * Skips notifications in WebView (notifications should be handled by native app)
 */
export async function showNotification(notification: {
  title?: string | null;
  content: string;
  id: string;
  sessionId?: string | null;
  orderId?: string | null;
  icon?: string;
  badge?: string;
}): Promise<boolean> {
  // Don't show browser notifications in WebView
  // Native app should handle notifications via FCM/push notifications
  if (isWebView()) {
    return false;
  }

  // On mobile, prefer Service Worker (works better in background)
  // On desktop, try Service Worker first, fallback to Notification API
  const isMobile = isMobileDevice();

  if (isMobile || isServiceWorkerSupported()) {
    const swSuccess = await showNotificationViaServiceWorker(notification);
    if (swSuccess) {
      return true;
    }
  }

  // Fallback to Notification API
  return showNotificationViaAPI(notification);
}
