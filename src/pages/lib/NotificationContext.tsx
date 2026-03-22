import BASE_URL from '@/lib/ApiEndpoints';
import { useUserContext } from '@/pages/lib/UserContext';
import { useWebSocketContext } from '@/pages/lib/WebSocketContext';
import { isWebView, showNotification } from '@/pages/lib/serviceWorker';
import { InAppNotification } from '@/pages/lib/types';
import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';

interface NotificationContextProps {
  notifications: InAppNotification[];
  unreadCount: number;
  isLoading: boolean;
  hasMore: boolean; // Whether there are more notifications to load
  loadNotifications: (cursorId?: string) => Promise<void>;
  markAsRead: (notificationIds: string[]) => Promise<void>;
  markSessionAsRead: (sessionId: string) => Promise<void>;
  refreshUnreadCount: () => Promise<void>;
}

const NotificationContext = createContext<NotificationContextProps>({
  notifications: [],
  unreadCount: 0,
  isLoading: false,
  hasMore: false,
  loadNotifications: async () => {},
  markAsRead: async () => {},
  markSessionAsRead: async () => {},
  refreshUnreadCount: async () => {},
});

export const useNotificationContext = () => useContext(NotificationContext);

/** Shared sort: unread first, then by createdAt descending */
function notificationSortComparator(
  a: InAppNotification,
  b: InAppNotification,
): number {
  if (a.isRead !== b.isRead) {
    return a.isRead ? 1 : -1;
  }
  return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
}

export const NotificationContextProvider = ({
  children,
}: {
  children: ReactNode;
}) => {
  const { user, accessToken } = useUserContext();
  const { isConnected, subscribe } = useWebSocketContext();
  const [notifications, setNotifications] = useState<InAppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const nextCursorRef = useRef<string | undefined>(undefined);
  const wsBatchReceivedRef = useRef(false); // Track if WebSocket batch was received
  const initialLoadDoneRef = useRef(false); // Track if initial API load was done

  const refreshUnreadCount = useCallback(async () => {
    if (!accessToken) return;

    try {
      const res = await fetch(`${BASE_URL}/api/notifications/count`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const data = await res.json();
      if (data.success) {
        setUnreadCount(data.data.count);
      }
    } catch (error) {
      console.error('Failed to refresh unread count:', error);
    }
  }, [accessToken]);

  const loadNotifications = useCallback(
    async (cursorId?: string | null) => {
      if (!accessToken) return;

      // Use provided cursorId or the stored nextCursor
      const actualCursorId =
        cursorId === null ? undefined : cursorId ?? nextCursorRef.current;

      // If we have a cursor, we're loading more. Otherwise, reset the list
      // But don't reset if WebSocket batch was already received (to preserve unread notifications)
      if (!actualCursorId && !wsBatchReceivedRef.current) {
        setNotifications([]);
      }

      setIsLoading(true);
      try {
        const queryParams = new URLSearchParams();
        if (actualCursorId) queryParams.append('cursorId', actualCursorId);
        queryParams.append('limit', '20');

        const res = await fetch(
          `${BASE_URL}/api/notifications?${queryParams.toString()}`,
          {
            method: 'GET',
            headers: { Authorization: `Bearer ${accessToken}` },
          },
        );
        const data = await res.json();
        if (data.success) {
          const newNotifications = data.data.notifications;
          setNotifications((prev) => {
            const existingIds = new Set(prev.map((n) => n.id));
            const notificationsToAdd = newNotifications.filter(
              (n: InAppNotification) => !existingIds.has(n.id),
            );

            let merged: InAppNotification[];
            if (actualCursorId || wsBatchReceivedRef.current) {
              merged = [...prev, ...notificationsToAdd];
            } else {
              merged = notificationsToAdd;
            }

            return merged.sort(notificationSortComparator);
          });
          nextCursorRef.current = data.data.nextCursor;
          if (!actualCursorId) {
            initialLoadDoneRef.current = true;
          }
        }
      } catch (error) {
        console.error('Failed to load notifications:', error);
      } finally {
        setIsLoading(false);
      }
    },
    [accessToken],
  );

  const markAsRead = useCallback(
    async (notificationIds: string[]) => {
      if (!accessToken || notificationIds.length === 0) return;

      try {
        const res = await fetch(`${BASE_URL}/api/notifications/mark-read`, {
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ notificationIds }),
        });
        const data = await res.json();
        if (data.success) {
          setNotifications((prev) => {
            const updated = prev.map((n) =>
              notificationIds.includes(n.id)
                ? { ...n, isRead: true, readAt: new Date() }
                : n,
            );
            return updated.sort(notificationSortComparator);
          });
          await refreshUnreadCount();
        }
      } catch (error) {
        console.error('Failed to mark notifications as read:', error);
      }
    },
    [accessToken, refreshUnreadCount],
  );

  const markSessionAsRead = useCallback(
    async (sessionId: string) => {
      if (!accessToken) return;

      try {
        const res = await fetch(`${BASE_URL}/api/notifications/mark-read`, {
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ sessionId }),
        });
        const data = await res.json();
        if (data.success) {
          setNotifications((prev) =>
            prev.map((n) =>
              n.sessionId === sessionId
                ? { ...n, isRead: true, readAt: new Date() }
                : n,
            ),
          );
          await refreshUnreadCount();
        }
      } catch (error) {
        console.error('Failed to mark session notifications as read:', error);
      }
    },
    [accessToken, refreshUnreadCount],
  );

  useEffect(() => {
    if (typeof window === 'undefined') {
      return undefined;
    }

    const handler = (event: MessageEvent) => {
      try {
        const raw = event.data;
        const data = typeof raw === 'string' ? JSON.parse(raw) : raw;
        if (data?.type === 'FCM_FOREGROUND_MESSAGE') {
          refreshUnreadCount();
          if (!isConnected) {
            loadNotifications(null);
          }
        }
      } catch (error) {
        console.error('Failed to process WebView message:', error);
      }
    };

    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [refreshUnreadCount]);

  // Subscribe to WebSocket messages for notifications
  useEffect(() => {
    if (!isConnected) {
      return undefined;
    }

    const unsubscribeNotification = subscribe('notification', (data) => {
      // Single notification received
      const notification = data.notification as InAppNotification;
      setNotifications((prev) => {
        // Check if already exists
        if (prev.some((n) => n.id === notification.id)) {
          return prev;
        }
        const merged = [notification, ...prev];
        return merged.sort(notificationSortComparator);
      });
      setUnreadCount((prev) => prev + 1);

      // Only show WebSocket notification if FCM is not available
      // FCM handles notifications when it's working, WebSocket is only fallback
      const hasFCMToken = localStorage.getItem('fcm_token');
      if (!hasFCMToken) {
        // No FCM token, show WebSocket notification as fallback
        showNotification({
          title: notification.title,
          content: notification.content,
          id: notification.id,
          sessionId: notification.sessionId,
          orderId: notification.orderId,
        }).catch((error) => {
          console.error('Failed to show notification:', error);
        });
      } else {
        // FCM is active, don't show duplicate notification
        // FCM will handle it via background/foreground handlers
        console.log(
          '[NotificationContext] Skipping WebSocket notification - FCM is active',
        );
      }
    });

    const unsubscribeNotifications = subscribe('notifications', (data) => {
      // Batch of notifications on connect
      const incomingNotifications = data.notifications as InAppNotification[];
      wsBatchReceivedRef.current = true; // Mark that WebSocket batch was received
      setNotifications((prev) => {
        // If we already have notifications from API load, merge them
        // Otherwise, use only WebSocket notifications
        if (prev.length === 0) {
          // No API load yet, use WebSocket notifications only
          return incomingNotifications.sort(notificationSortComparator);
        }
        // Merge with existing notifications from API
        const existingIds = new Set(prev.map((n) => n.id));
        const uniqueNew = incomingNotifications.filter(
          (n) => !existingIds.has(n.id),
        );
        const merged = [...uniqueNew, ...prev];
        // Always sort: unread first, then read, both by createdAt desc
        return merged.sort(notificationSortComparator);
      });
      setUnreadCount(data.unreadCount || 0);

      // If WebSocket batch arrived first, now load read notifications from API
      if (!initialLoadDoneRef.current) {
        loadNotifications().catch((error) => {
          console.error('Failed to load read notifications:', error);
        });
      }
    });

    return () => {
      unsubscribeNotification();
      unsubscribeNotifications();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isConnected, subscribe, loadNotifications]);

  useEffect(() => {
    if (typeof window === 'undefined' || !isWebView()) return undefined;

    const handleForegroundMessage = (event: MessageEvent) => {
      try {
        const data =
          typeof event.data === 'string' ? JSON.parse(event.data) : event.data;

        if (data && data.type === 'FCM_FOREGROUND_MESSAGE') {
          console.log(
            '[NotificationContext] Foreground FCM message received (Mobile):',
            data,
          );
          refreshUnreadCount();
          loadNotifications(null);
        }
      } catch (error) {
        if (typeof event.data === 'string' && event.data.includes('FCM_')) {
          console.error(
            '[NotificationContext] Failed to parse foreground message:',
            error,
          );
        }
      }
    };

    window.addEventListener('message', handleForegroundMessage);
    return () => {
      window.removeEventListener('message', handleForegroundMessage);
    };
  }, [refreshUnreadCount, loadNotifications]);

  // Load initial notifications and count
  // Wait a bit for WebSocket to connect and send batch first
  useEffect(() => {
    if (user && accessToken) {
      // Reset flags on new user/login
      wsBatchReceivedRef.current = false;
      initialLoadDoneRef.current = false;

      if (!wsBatchReceivedRef.current && !initialLoadDoneRef.current) {
        loadNotifications(null);
      }

      refreshUnreadCount();

      return () => {};
    }
    setNotifications([]);
    setUnreadCount(0);
    wsBatchReceivedRef.current = false;
    initialLoadDoneRef.current = false;
    return undefined;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, accessToken]);

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        unreadCount,
        isLoading,
        hasMore: !!nextCursorRef.current,
        loadNotifications,
        markAsRead,
        markSessionAsRead,
        refreshUnreadCount,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
};
