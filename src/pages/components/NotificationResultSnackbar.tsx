import { mobileBottomNavHeight } from '@/pages/lib/constants';
import {
  EnableNotificationsResult,
  openNativeNotificationSettings,
} from '@/pages/lib/fcm/fcmClient';
import { isWebView } from '@/pages/lib/serviceWorker';
import { snackbarClasses } from '@/styles/classMaps/components/snackbar';
import { fontClassName } from '@/styles/theme';
import { Box, Snackbar, Typography } from '@mui/material';
import { AlertTriangle } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useRef } from 'react';

export default function NotificationResultSnackbar({
  result,
  onClose,
  explainDismissed = false,
}: {
  result: EnableNotificationsResult | null;
  onClose: () => void;
  explainDismissed?: boolean;
}) {
  const t = useTranslations();
  const inApp = isWebView();

  let message: string | null = null;
  if (result === 'failed') {
    message = t('notificationsEnableFailed');
  } else if (result === 'blocked') {
    message = inApp ? t('notificationsBlockedApp') : t('notificationsDenied');
  } else if (result === 'dismissed' && explainDismissed && inApp) {
    message = t('notificationsDismissedApp');
  }
  const canOpenSettings = inApp && result === 'blocked';

  const shown = useRef({ message, canOpenSettings });
  if (message !== null) shown.current = { message, canOpenSettings };

  return (
    <Snackbar
      open={message !== null}
      autoHideDuration={shown.current.canOpenSettings ? 6000 : 4000}
      disableWindowBlurListener
      onClose={onClose}
      anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
      sx={{ bottom: `${mobileBottomNavHeight + 8}px !important` }}
    >
      <Box className={snackbarClasses.pill}>
        <AlertTriangle className={snackbarClasses.icon.warning} size={20} />
        <Typography
          className={`${fontClassName.className} ${snackbarClasses.message}`}
        >
          {shown.current.message}
        </Typography>
        {shown.current.canOpenSettings && (
          <Typography
            component="button"
            onClick={() => {
              openNativeNotificationSettings();
              onClose();
            }}
            className={`${fontClassName.className} ${snackbarClasses.viewLink}`}
          >
            {t('openSettings')}
          </Typography>
        )}
      </Box>
    </Snackbar>
  );
}
