import BASE_URL from '@/lib/ApiEndpoints';
import { useUserContext } from '@/pages/lib/UserContext';
import { showNotification } from '@/pages/lib/serviceWorker';
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

export const NotificationContextProvider = ({
  children,
}: {
  children: ReactNode;
}) => {
  const { user, accessToken } = useUserContext();
  const [notifications, setNotifications] = useState<InAppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const nextCursorRef = useRef<string | undefined>(undefined);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout>();
  const reconnectAttemptsRef = useRef(0);
  const maxReconnectAttempts = 10;

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
    async (cursorId?: string) => {
      if (!accessToken) return;

      // Use provided cursorId or the stored nextCursor
      const actualCursorId = cursorId ?? nextCursorRef.current;

      // If we have a cursor, we're loading more. Otherwise, reset the list
      if (!actualCursorId) {
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
            // Deduplicate by id
            const existingIds = new Set(prev.map((n) => n.id));
            const uniqueNew = newNotifications.filter(
              (n: InAppNotification) => !existingIds.has(n.id),
            );
            return actualCursorId ? [...prev, ...uniqueNew] : uniqueNew;
          });
          nextCursorRef.current = data.data.nextCursor;
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
          setNotifications((prev) =>
            prev.map((n) =>
              notificationIds.includes(n.id)
                ? { ...n, isRead: true, readAt: new Date() }
                : n,
            ),
          );
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

  // Connect to WebSocket for real-time notifications with reconnection
  const connectWebSocket = useCallback(() => {
    if (!user || !accessToken) {
      return;
    }

    const wsBase =
      process.env.NODE_ENV === 'production'
        ? `wss://xmobile.com.tm`
        : process.env.NEXT_PUBLIC_WS_URL;
    const wsUrl = `${wsBase}/ws/?accessToken=${accessToken}`;

    try {
      wsRef.current = new WebSocket(wsUrl);

      wsRef.current.onopen = () => {
        console.log('Notification WebSocket connected');
        reconnectAttemptsRef.current = 0; // Reset on successful connection
      };

      wsRef.current.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);

          if (data.type === 'notification') {
            // Single notification received
            const notification = data.notification as InAppNotification;
            setNotifications((prev) => {
              // Check if already exists
              if (prev.some((n) => n.id === notification.id)) {
                return prev;
              }
              return [notification, ...prev];
            });
            setUnreadCount((prev) => prev + 1);

            // Show notification using Service Worker (mobile) or Notification API (desktop)
            // Works in both foreground and background on mobile browsers
            showNotification({
              title: notification.title,
              content: notification.content,
              id: notification.id,
              sessionId: notification.sessionId,
            }).catch((error) => {
              console.error('Failed to show notification:', error);
            });
          } else if (data.type === 'notifications') {
            // Batch of notifications on connect
            const incomingNotifications =
              data.notifications as InAppNotification[];
            setNotifications((prev) => {
              const existingIds = new Set(prev.map((n) => n.id));
              const uniqueNew = incomingNotifications.filter(
                (n) => !existingIds.has(n.id),
              );
              return [...uniqueNew, ...prev];
            });
            setUnreadCount(data.unreadCount || 0);
          }
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error);
        }
      };

      wsRef.current.onerror = (error) => {
        console.error('Notification WebSocket error:', error);
      };

      wsRef.current.onclose = (event) => {
        console.log(
          'Notification WebSocket disconnected',
          event.code,
          event.reason,
        );

        // Don't reconnect if it was a clean close or user/auth issue
        if (event.code === 1000 || event.code === 1008) {
          return;
        }

        // Exponential backoff reconnection
        if (reconnectAttemptsRef.current < maxReconnectAttempts) {
          const delay = Math.min(
            1000 * 2 ** reconnectAttemptsRef.current,
            30000,
          );
          reconnectAttemptsRef.current += 1;

          console.log(
            `Reconnecting in ${delay}ms (attempt ${reconnectAttemptsRef.current}/${maxReconnectAttempts})`,
          );

          reconnectTimeoutRef.current = setTimeout(() => {
            if (user && accessToken) {
              connectWebSocket();
            }
          }, delay);
        } else {
          console.error(
            'Max reconnection attempts reached. Please refresh the page.',
          );
        }
      };
    } catch (error) {
      console.error('Failed to create WebSocket connection:', error);
    }
  }, [user, accessToken]);

  useEffect(() => {
    if (!user || !accessToken) {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = undefined;
      }
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      reconnectAttemptsRef.current = 0;
      return undefined;
    }

    connectWebSocket();

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = undefined;
      }
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      reconnectAttemptsRef.current = 0;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, accessToken, connectWebSocket]);

  // Load initial notifications and count
  useEffect(() => {
    if (user && accessToken) {
      loadNotifications();
      refreshUnreadCount();
    } else {
      setNotifications([]);
      setUnreadCount(0);
    }
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
