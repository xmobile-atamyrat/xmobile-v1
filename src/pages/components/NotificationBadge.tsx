import { useNotificationContext } from '@/pages/lib/NotificationContext';
import { usePlatform } from '@/pages/lib/PlatformContext';
import { notificationClasses } from '@/styles/classMaps/components/notifications';
import Badge from '@mui/material/Badge';
import Box from '@mui/material/Box';
import CardMedia from '@mui/material/CardMedia';
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
            fontSize: platform === 'web' ? '11px' : '9px',
            fontWeight: 600,
            minWidth: platform === 'web' ? '18px' : '16px',
            height: platform === 'web' ? '18px' : '16px',
            padding: platform === 'web' ? '0 4px' : '0 4px',
          },
        }}
      >
        <IconButton
          onClick={onClick}
          aria-label="notifications"
          className="p-2"
          size="small"
        >
          <CardMedia
            component="img"
            src="/bell.png"
            className={notificationClasses.badge.icon[platform]}
          />
        </IconButton>
      </Badge>
    </Box>
  );
}
