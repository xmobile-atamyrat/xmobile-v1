import { useNotificationContext } from '@/pages/lib/NotificationContext';
import { usePlatform } from '@/pages/lib/PlatformContext';
import { notificationClasses } from '@/styles/classMaps/components/notifications';
import Badge from '@mui/material/Badge';
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
      <Badge
        badgeContent={unreadCount > 99 ? '99+' : unreadCount}
        color="error"
        sx={{
          '& .MuiBadge-badge': {
            backgroundColor: '#E41E2B',
            fontSize: platform === 'web' ? '11px' : '9px',
            fontWeight: 700,
            minWidth: platform === 'web' ? '18px' : '16px',
            height: platform === 'web' ? '18px' : '16px',
            padding: platform === 'web' ? '0 4px' : '0 4px',
          },
        }}
      >
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
      </Badge>
    </Box>
  );
}
