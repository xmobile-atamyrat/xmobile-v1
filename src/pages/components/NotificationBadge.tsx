import CountBadge from '@/pages/components/CountBadge';
import { useNotificationContext } from '@/pages/lib/NotificationContext';
import { usePlatform } from '@/pages/lib/PlatformContext';
import { notificationClasses } from '@/styles/classMaps/components/notifications';
import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import { Bell } from 'lucide-react';

interface NotificationBadgeProps {
  onClick: (event: React.MouseEvent<HTMLElement>) => void;
}

export default function NotificationBadge({ onClick }: NotificationBadgeProps) {
  const { unreadCount } = useNotificationContext();
  const platform = usePlatform();

  return (
    <Box className={notificationClasses.badge.container[platform]}>
      <CountBadge count={unreadCount}>
        <IconButton
          onClick={onClick}
          aria-label="notifications"
          // no padding on web: the header spaces its action icons at a flat
          // 26px, so an 8px-padded button breaks the rhythm (spec 1295-1298)
          className={platform === 'web' ? 'p-0' : 'p-2'}
          size="small"
        >
          <Bell className={notificationClasses.badge.icon[platform]} />
        </IconButton>
      </CountBadge>
    </Box>
  );
}
