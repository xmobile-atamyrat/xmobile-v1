import { usePlatform } from '@/pages/lib/PlatformContext';
import { notificationClasses } from '@/styles/classMaps/components/notifications';
import { interClassname } from '@/styles/theme';
import CloseIcon from '@mui/icons-material/Close';
import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import { useTranslations } from 'next-intl';
import { useCallback, useState } from 'react';

export default function NotificationPermissionBanner() {
  const platform = usePlatform();
  const t = useTranslations();
  const [dismissed, setDismissed] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission | null>(
    typeof window !== 'undefined' ? Notification.permission : null,
  );

  const requestPermission = useCallback(async () => {
    if (!('Notification' in window)) {
      console.warn('This browser does not support notifications');
      return;
    }

    if (Notification.permission === 'default') {
      const result = await Notification.requestPermission();
      setPermission(result);
      if (result === 'granted') {
        setDismissed(true);
        // Show a test notification to confirm it works
        try {
          const testNotification = new Notification('Notifications enabled', {
            body: 'You will receive notifications for new messages',
            icon: '/xm-logo.png',
            tag: 'test-notification',
          });
          setTimeout(() => testNotification.close(), 3000);
        } catch (error) {
          console.error('Failed to show test notification:', error);
        }
      }
    } else if (Notification.permission === 'denied') {
      // Permission was previously denied, inform user
      alert(
        'Notification permission was denied. Please enable it in your browser settings to receive notifications.',
      );
    }
  }, []);

  // Don't show if:
  // - Already dismissed
  // - Permission already granted or denied
  // - Notifications not supported
  if (
    dismissed ||
    permission === 'granted' ||
    permission === 'denied' ||
    typeof window === 'undefined' ||
    !('Notification' in window)
  ) {
    return null;
  }

  return (
    <Box className={notificationClasses.permissionBanner.container[platform]}>
      <Typography
        className={`${notificationClasses.permissionBanner.text[platform]} ${interClassname.className}`}
      >
        {t('enableNotifications')}
      </Typography>
      <Box className="flex items-center gap-[8px]">
        <Typography
          onClick={requestPermission}
          className={`${notificationClasses.permissionBanner.button[platform]} ${interClassname.className}`}
        >
          {t('enable')}
        </Typography>
        <IconButton
          size="small"
          onClick={() => setDismissed(true)}
          className="p-1"
        >
          <CloseIcon className="w-[16px] h-[16px] text-[#856404]" />
        </IconButton>
      </Box>
    </Box>
  );
}
