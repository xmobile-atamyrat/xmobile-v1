import BASE_URL from '@/lib/ApiEndpoints';
import { useUserContext } from '@/pages/lib/UserContext';
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
  loadNotifications: (cursorId?: string) => Promise<void>;
  markAsRead: (notificationIds: string[]) => Promise<void>;
  markSessionAsRead: (sessionId: string) => Promise<void>;
  refreshUnreadCount: () => Promise<void>;
}

const NotificationContext = createContext<NotificationContextProps>({
  notifications: [],
  unreadCount: 0,
  isLoading: false,
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

      setIsLoading(true);
      try {
        const queryParams = new URLSearchParams();
        if (cursorId) queryParams.append('cursorId', cursorId);
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
            return [...prev, ...uniqueNew];
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

  // Connect to WebSocket for real-time notifications
  useEffect(() => {
    if (!user || !accessToken) {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      return undefined;
    }

    const wsBase =
      process.env.NODE_ENV === 'production'
        ? `wss://xmobile.com.tm`
        : `ws://localhost:${process.env.NEXT_PUBLIC_WEBSOCKET_PORT}`;
    const wsUrl = `${wsBase}/ws/?accessToken=${accessToken}`;
    wsRef.current = new WebSocket(wsUrl);

    wsRef.current.onopen = () => {
      console.log('Notification WebSocket connected');
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

          // Show browser notification if permission granted
          if (
            'Notification' in window &&
            Notification.permission === 'granted'
          ) {
            new Notification(notification.title || 'New message', {
              body: notification.content,
              icon: '/xm-logo.png',
              tag: notification.id,
            });
          }
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

    wsRef.current.onclose = () => {
      console.log('Notification WebSocket disconnected');
    };

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, accessToken]);

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
