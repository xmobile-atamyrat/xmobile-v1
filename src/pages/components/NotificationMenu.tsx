import { useNotificationContext } from '@/pages/lib/NotificationContext';
import { groupChatNotifications } from '@/pages/lib/notificationGrouping';
import { usePlatform } from '@/pages/lib/PlatformContext';
import { useUserContext } from '@/pages/lib/UserContext';
import { InAppNotification } from '@/pages/lib/types';
import { notificationClasses } from '@/styles/classMaps/components/notifications';
import { fontClassName, red } from '@/styles/theme';
import Dialog from '@mui/material/Dialog';
import Menu from '@mui/material/Menu';
import Paper from '@mui/material/Paper';
import Slide from '@mui/material/Slide';
import { TransitionProps } from '@mui/material/transitions';
import Typography from '@mui/material/Typography';
import { ArrowLeft, ChevronDown, MessageCircle, Truck } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/router';
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

const SlideTransition = React.forwardRef(function Transition(
  props: TransitionProps & { children: React.ReactElement },
  ref: React.Ref<unknown>,
) {
  return <Slide direction="up" ref={ref} {...props} />;
});

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
    markSessionAsRead,
  } = useNotificationContext();
  const { accessToken } = useUserContext();
  const platform = usePlatform();
  const t = useTranslations();
  const router = useRouter();
  const listRef = useRef<HTMLDivElement>(null);
  const loadingRef = useRef(false);
  const [expandedSessions, setExpandedSessions] = useState<Set<string>>(
    () => new Set(),
  );

  // Collapse chat notifications from the same session into WhatsApp-style
  // expandable groups; order notifications and lone chats stay single rows.
  const groupedNotifications = useMemo(
    () => groupChatNotifications(notifications),
    [notifications],
  );

  const toggleSession = useCallback((sessionId: string) => {
    setExpandedSessions((prev) => {
      const next = new Set(prev);
      if (next.has(sessionId)) {
        next.delete(sessionId);
      } else {
        next.add(sessionId);
      }
      return next;
    });
  }, []);

  const openSession = useCallback(
    async (sessionId: string) => {
      await markSessionAsRead(sessionId);
      onClose();
      router.push(`/chat?sessionId=${sessionId}`);
    },
    [markSessionAsRead, onClose, router],
  );

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

  const renderSingle = (notification: InAppNotification) => {
    const isOrder = notification.type === 'ORDER_STATUS_UPDATE';
    return (
      <div
        key={notification.id}
        className={`${notificationClasses.item.container[platform]} ${
          !notification.isRead ? notificationClasses.item.unread[platform] : ''
        }`}
        onClick={() => handleNotificationClick(notification)}
      >
        <span
          className={`w-[40px] h-[40px] rounded-[11px] flex items-center justify-center flex-none ${
            isOrder
              ? notificationClasses.item.icon.order
              : notificationClasses.item.icon.chat
          }`}
        >
          {isOrder ? <Truck size={20} /> : <MessageCircle size={20} />}
        </span>
        <div className={notificationClasses.item.content[platform]}>
          {notification.title && (
            <Typography
              className={`${notificationClasses.item.title[platform]} ${fontClassName.className}`}
            >
              {notification.title}
            </Typography>
          )}
          <Typography
            className={`${notificationClasses.item.text[platform]} ${fontClassName.className}`}
          >
            {notification.content}
          </Typography>
          <Typography
            className={`${notificationClasses.item.time[platform]} ${fontClassName.className}`}
          >
            {formatTime(notification.createdAt)}
          </Typography>
        </div>
        {!notification.isRead && (
          <span
            className="absolute top-[14px] right-[12px] w-[8px] h-[8px] rounded-full"
            style={{ background: red }}
          />
        )}
      </div>
    );
  };

  const renderGroup = (group: {
    sessionId: string;
    items: InAppNotification[];
    latest: InAppNotification;
    unread: number;
  }) => {
    const expanded = expandedSessions.has(group.sessionId);
    return (
      <div
        key={group.sessionId}
        className={notificationClasses.group.card[platform]}
      >
        <div
          className={notificationClasses.group.headerRow}
          onClick={() => openSession(group.sessionId)}
        >
          <span
            className={`w-[40px] h-[40px] rounded-[11px] flex items-center justify-center flex-none ${notificationClasses.item.icon.chat}`}
          >
            <MessageCircle size={20} />
          </span>
          <div className={notificationClasses.item.content[platform]}>
            {group.latest.title && (
              <Typography
                className={`${notificationClasses.item.title[platform]} ${fontClassName.className}`}
              >
                {group.latest.title}
              </Typography>
            )}
            <Typography
              className={`${notificationClasses.group.count} ${fontClassName.className}`}
            >
              {group.unread > 0
                ? `${group.unread} ${t('newMessages')}`
                : `${group.items.length} ${t('messages')}`}
            </Typography>
            <Typography
              className={`${notificationClasses.item.text[platform]} ${fontClassName.className}`}
            >
              {group.latest.content}
            </Typography>
            <Typography
              className={`${notificationClasses.item.time[platform]} ${fontClassName.className}`}
            >
              {formatTime(group.latest.createdAt)}
            </Typography>
          </div>
          <button
            type="button"
            aria-label="toggle"
            className={`${notificationClasses.group.chevron} ${
              expanded ? 'rotate-180' : ''
            }`}
            onClick={(e) => {
              e.stopPropagation();
              toggleSession(group.sessionId);
            }}
          >
            <ChevronDown size={18} />
          </button>
          {group.unread > 0 && (
            <span
              className="absolute top-[2px] right-[26px] w-[8px] h-[8px] rounded-full"
              style={{ background: red }}
            />
          )}
        </div>
        {expanded && (
          <div className={notificationClasses.group.subList}>
            {group.items.map((item) => (
              <div
                key={item.id}
                className={notificationClasses.group.subItem}
                onClick={() => openSession(group.sessionId)}
              >
                <Typography
                  className={`${notificationClasses.group.subText} ${fontClassName.className}`}
                >
                  {item.content}
                </Typography>
                <Typography
                  className={`${notificationClasses.group.subTime} ${fontClassName.className}`}
                >
                  {formatTime(item.createdAt)}
                </Typography>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  const listContent = (
    <>
      {notifications.length === 0 && !isLoading ? (
        <Typography
          className={`${notificationClasses.menu.empty[platform]} ${fontClassName.className}`}
        >
          {t('noNotifications')}
        </Typography>
      ) : (
        groupedNotifications.map((row) =>
          row.kind === 'group'
            ? renderGroup(row)
            : renderSingle(row.notification),
        )
      )}
      {isLoading && (
        <Typography
          className={`${notificationClasses.menu.empty[platform]} ${fontClassName.className}`}
        >
          {t('loading')}...
        </Typography>
      )}
    </>
  );

  // Mobile: full-screen slide-up sheet (design's dedicated Notifications screen)
  if (platform === 'mobile') {
    return (
      <Dialog
        fullScreen
        open={open}
        onClose={onClose}
        TransitionComponent={SlideTransition}
        PaperProps={{ className: notificationClasses.sheet.paper }}
      >
        <div className={notificationClasses.sheet.header}>
          <div className="flex items-center gap-[14px]">
            <button
              type="button"
              onClick={onClose}
              aria-label="back"
              className={notificationClasses.sheet.backButton}
            >
              <ArrowLeft size={20} />
            </button>
            <Typography
              className={`${notificationClasses.sheet.title} ${fontClassName.className}`}
            >
              {t('notifications')}
            </Typography>
          </div>
          {unreadCount > 0 && (
            <Typography
              onClick={handleMarkAllRead}
              className={`${notificationClasses.menu.clearButton.mobile} ${fontClassName.className}`}
            >
              {t('markAllRead')}
            </Typography>
          )}
        </div>
        <div ref={listRef} className={notificationClasses.sheet.list}>
          {listContent}
        </div>
      </Dialog>
    );
  }

  // Web: dropdown menu anchored to the app-bar bell
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
          className={`${notificationClasses.menu.title[platform]} ${fontClassName.className}`}
        >
          {t('notifications')}
        </Typography>
        {unreadCount > 0 && (
          <Typography
            onClick={handleMarkAllRead}
            className={`${notificationClasses.menu.clearButton[platform]} ${fontClassName.className}`}
          >
            {t('markAllRead')}
          </Typography>
        )}
      </Paper>

      <div ref={listRef} className={notificationClasses.menu.list[platform]}>
        {listContent}
      </div>
    </Menu>
  );
}
