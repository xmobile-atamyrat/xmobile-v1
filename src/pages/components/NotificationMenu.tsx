import { useNotificationContext } from '@/pages/lib/NotificationContext';
import { usePlatform } from '@/pages/lib/PlatformContext';
import { useUserContext } from '@/pages/lib/UserContext';
import { InAppNotification } from '@/pages/lib/types';
import { notificationClasses } from '@/styles/classMaps/components/notifications';
import { interClassname } from '@/styles/theme';
import Menu from '@mui/material/Menu';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/router';
import { useCallback, useEffect, useRef } from 'react';

interface NotificationMenuProps {
  anchorEl: HTMLElement | null;
  open: boolean;
  onClose: () => void;
}

export default function NotificationMenu({
  anchorEl,
  open,
  onClose,
}: NotificationMenuProps) {
  const {
    notifications,
    unreadCount,
    isLoading,
    hasMore,
    loadNotifications,
    markAsRead,
  } = useNotificationContext();
  const { accessToken } = useUserContext();
  const platform = usePlatform();
  const t = useTranslations();
  const router = useRouter();
  const listRef = useRef<HTMLDivElement>(null);
  const loadingRef = useRef(false);

  const handleNotificationClick = useCallback(
    async (notification: InAppNotification) => {
      if (!notification.isRead) {
        await markAsRead([notification.id]);
      }
      onClose();

      // Route based on notification type
      if (notification.type === 'ORDER_STATUS_UPDATE' && notification.orderId) {
        router.push(`/orders/${notification.orderId}`);
      } else if (
        notification.type === 'CHAT_MESSAGE' &&
        notification.sessionId
      ) {
        router.push(`/chat?sessionId=${notification.sessionId}`);
      } else {
        router.push('/');
      }
    },
    [markAsRead, onClose, router],
  );

  const handleMarkAllRead = useCallback(async () => {
    const unreadIds = notifications.filter((n) => !n.isRead).map((n) => n.id);
    if (unreadIds.length > 0) {
      await markAsRead(unreadIds);
    }
  }, [notifications, markAsRead]);

  const loadMore = useCallback(async () => {
    if (loadingRef.current || !accessToken || !hasMore) return;

    loadingRef.current = true;
    try {
      // Load more notifications - cursor is managed internally via nextCursorRef
      await loadNotifications();
    } finally {
      loadingRef.current = false;
    }
  }, [loadNotifications, accessToken, hasMore]);

  // Load more when scrolling to bottom
  useEffect(() => {
    if (!open || !listRef.current) {
      return undefined;
    }

    const handleScroll = () => {
      const element = listRef.current;
      if (!element) return;

      const { scrollTop, scrollHeight, clientHeight } = element;
      if (scrollHeight - scrollTop - clientHeight < 100 && hasMore) {
        loadMore();
      }
    };

    const element = listRef.current;
    element.addEventListener('scroll', handleScroll);
    return () => {
      element.removeEventListener('scroll', handleScroll);
    };
  }, [open, loadMore]);

  const formatTime = (date: Date | string) => {
    const d = typeof date === 'string' ? new Date(date) : date;
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return t('justNow');
    if (minutes < 60) return `${minutes}${t('minutesAgo')}`;
    if (hours < 24) return `${hours}${t('hoursAgo')}`;
    if (days < 7) return `${days}${t('daysAgo')}`;
    return d.toLocaleDateString();
  };

  return (
    <Menu
      anchorEl={anchorEl}
      open={open}
      onClose={onClose}
      anchorOrigin={{
        vertical: 'bottom',
        horizontal: 'right',
      }}
      transformOrigin={{
        vertical: 'top',
        horizontal: 'right',
      }}
      PaperProps={{
        className: notificationClasses.menu.paper[platform],
      }}
    >
      <Paper className={notificationClasses.menu.header[platform]}>
        <Typography
          className={`${notificationClasses.menu.title[platform]} ${interClassname.className}`}
        >
          {t('notifications')}
        </Typography>
        {unreadCount > 0 && (
          <Typography
            onClick={handleMarkAllRead}
            className={`${notificationClasses.menu.clearButton[platform]} ${interClassname.className}`}
          >
            {t('markAllRead')}
          </Typography>
        )}
      </Paper>

      <div ref={listRef} className={notificationClasses.menu.list[platform]}>
        {notifications.length === 0 && !isLoading ? (
          <Typography
            className={`${notificationClasses.menu.empty[platform]} ${interClassname.className}`}
          >
            {t('noNotifications')}
          </Typography>
        ) : (
          notifications.map((notification) => (
            <div
              key={notification.id}
              className={`${notificationClasses.item.container[platform]} ${
                !notification.isRead
                  ? notificationClasses.item.unread[platform]
                  : ''
              }`}
              onClick={() => handleNotificationClick(notification)}
            >
              <div className={notificationClasses.item.content[platform]}>
                {notification.title && (
                  <Typography
                    className={`${notificationClasses.item.title[platform]} ${interClassname.className}`}
                  >
                    {notification.title}
                  </Typography>
                )}
                <Typography
                  className={`${notificationClasses.item.text[platform]} ${interClassname.className}`}
                >
                  {notification.content}
                </Typography>
                <Typography
                  className={`${notificationClasses.item.time[platform]} ${interClassname.className}`}
                >
                  {formatTime(notification.createdAt)}
                </Typography>
              </div>
            </div>
          ))
        )}
        {isLoading && (
          <Typography
            className={`${notificationClasses.menu.empty[platform]} ${interClassname.className}`}
          >
            {t('loading')}...
          </Typography>
        )}
      </div>
    </Menu>
  );
}
