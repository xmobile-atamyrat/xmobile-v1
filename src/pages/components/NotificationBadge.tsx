import { useNotificationContext } from '@/pages/lib/NotificationContext';
import { usePlatform } from '@/pages/lib/PlatformContext';
import { notificationClasses } from '@/styles/classMaps/components/notifications';
import NotificationsIcon from '@mui/icons-material/Notifications';
import Badge from '@mui/material/Badge';
import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';

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
            backgroundColor: '#ff624c',
            fontSize: '11px',
            fontWeight: 600,
            minWidth: '18px',
            height: '18px',
            padding: '0 4px',
          },
        }}
      >
        <IconButton
          onClick={onClick}
          aria-label="notifications"
          className="p-2"
          size="small"
        >
          <NotificationsIcon
            className={notificationClasses.badge.icon[platform]}
          />
        </IconButton>
      </Badge>
    </Box>
  );
}
