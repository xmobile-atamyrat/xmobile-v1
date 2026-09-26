import NotificationResultSnackbar from '@/pages/components/NotificationResultSnackbar';
import {
  enableNotifications,
  EnableNotificationsResult,
  getPermissionState,
  isNotificationsOptedOut,
  isNotificationsSupported,
  requestNotificationsPermission,
} from '@/pages/lib/fcm/fcmClient';
import { afterNativeOnboarding } from '@/pages/lib/nativeOnboarding';
import {
  isPromptDue,
  NOTIFICATION_PROMPT_MAX_DECLINES,
  NotificationPromptReason,
  readPromptState,
  writePromptState,
} from '@/pages/lib/notificationPrompt';
import { usePlatform } from '@/pages/lib/PlatformContext';
import { useUserContext } from '@/pages/lib/UserContext';
import { notificationPromptClasses } from '@/styles/classMaps/components/notificationPrompt';
import { fontClassName } from '@/styles/theme';
import { Box, ButtonBase, Dialog, Typography } from '@mui/material';
import { BellRing } from 'lucide-react';
import { useTranslations } from 'next-intl';
import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

const WELCOME_DELAY_MS = 4000;
const ONBOARDING_FALLBACK_MS = 3000;

type NotificationPromptContextType = {
  promptNotifications: (reason: NotificationPromptReason) => void;
};

const NotificationPromptContext = createContext<NotificationPromptContextType>({
  promptNotifications: () => {},
});

export const useNotificationPrompt = () =>
  useContext(NotificationPromptContext);

const BODY_KEY: Record<NotificationPromptReason, string> = {
  welcome: 'notifPromptWelcome',
  order: 'notifPromptOrder',
  chat: 'notifPromptChat',
};

function PromptDialog({
  reason,
  busy,
  onEnable,
  onLater,
}: {
  reason: NotificationPromptReason | null;
  busy: boolean;
  onEnable: () => void;
  onLater: () => void;
}) {
  const t = useTranslations();
  const platform = usePlatform();
  const lastReason = useRef<NotificationPromptReason>('welcome');
  if (reason) lastReason.current = reason;

  return (
    <Dialog
      open={reason !== null}
      onClose={busy ? undefined : onLater}
      sx={
        platform === 'mobile'
          ? { '& .MuiDialog-container': { alignItems: 'flex-end' } }
          : undefined
      }
      PaperProps={{
        className: notificationPromptClasses.paper[platform],
        sx: { m: 0, maxWidth: 'none' },
      }}
    >
      {platform === 'mobile' && (
        <Box className={notificationPromptClasses.handle} />
      )}
      <Box className={notificationPromptClasses.iconWrap}>
        <BellRing className={notificationPromptClasses.icon} />
      </Box>
      <Typography
        className={`${notificationPromptClasses.title} ${fontClassName.className}`}
      >
        {t('notifPromptTitle')}
      </Typography>
      <Typography
        className={`${notificationPromptClasses.text} ${fontClassName.className}`}
      >
        {t(BODY_KEY[lastReason.current])}
      </Typography>
      <ButtonBase
        disableRipple
        disabled={busy}
        onClick={onEnable}
        className={`${notificationPromptClasses.enable} ${fontClassName.className}`}
      >
        {t('enable')}
      </ButtonBase>
      <ButtonBase
        disableRipple
        disabled={busy}
        onClick={onLater}
        className={`${notificationPromptClasses.later} ${fontClassName.className}`}
      >
        {t('notifPromptLater')}
      </ButtonBase>
    </Dialog>
  );
}

export default function NotificationPromptProvider({
  children,
}: {
  children: ReactNode;
}) {
  const { user, accessToken, isLoading } = useUserContext();
  const [reason, setReason] = useState<NotificationPromptReason | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<EnableNotificationsResult | null>(null);
  const checkingRef = useRef(false);
  const openRef = useRef(false);
  openRef.current = reason !== null;

  const promptNotifications = useCallback(
    async (next: NotificationPromptReason) => {
      if (checkingRef.current || openRef.current) return;
      if (
        !isPromptDue(next, readPromptState(), {
          signedIn: !!user,
          now: Date.now(),
        })
      ) {
        return;
      }

      checkingRef.current = true;
      try {
        const askable =
          isNotificationsSupported() &&
          !(user && isNotificationsOptedOut(user.id)) &&
          (await getPermissionState()) === 'default';

        if (next === 'welcome') {
          if (!askable) writePromptState({ welcomeSeen: true });
        } else {
          writePromptState({ lastCheckedAt: Date.now() });
        }
        if (askable) setReason(next);
      } finally {
        checkingRef.current = false;
      }
    },
    [user],
  );

  useEffect(() => {
    if (isLoading) return undefined;
    if (readPromptState().welcomeSeen) return undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const cancel = afterNativeOnboarding(() => {
      timer = setTimeout(() => {
        promptNotifications('welcome');
      }, WELCOME_DELAY_MS);
    }, ONBOARDING_FALLBACK_MS);
    return () => {
      cancel();
      clearTimeout(timer);
    };
  }, [isLoading, promptNotifications]);

  const recordAnswer = useCallback(
    (declines?: number) => {
      writePromptState({
        ...(reason === 'welcome' ? { welcomeSeen: true } : {}),
        lastCheckedAt: Date.now(),
        ...(declines !== undefined ? { declines } : {}),
      });
    },
    [reason],
  );

  const handleLater = useCallback(() => {
    recordAnswer((readPromptState().declines ?? 0) + 1);
    setReason(null);
  }, [recordAnswer]);

  const handleEnable = useCallback(async () => {
    setBusy(true);
    try {
      const outcome =
        user && accessToken
          ? await enableNotifications(accessToken, user.id)
          : await requestNotificationsPermission();
      if (outcome === 'blocked') {
        recordAnswer(NOTIFICATION_PROMPT_MAX_DECLINES);
      } else if (outcome === 'dismissed') {
        recordAnswer((readPromptState().declines ?? 0) + 1);
      } else {
        recordAnswer();
      }
      if (outcome === 'blocked' || outcome === 'failed') setResult(outcome);
    } finally {
      setBusy(false);
      setReason(null);
    }
  }, [user, accessToken, recordAnswer]);

  const value = useMemo(
    () => ({
      promptNotifications: (next: NotificationPromptReason) => {
        promptNotifications(next).catch((error) => {
          console.error('[NotificationPrompt] Failed to check prompt:', error);
        });
      },
    }),
    [promptNotifications],
  );

  return (
    <NotificationPromptContext.Provider value={value}>
      {children}
      <PromptDialog
        reason={reason}
        busy={busy}
        onEnable={handleEnable}
        onLater={handleLater}
      />
      <NotificationResultSnackbar
        result={result}
        onClose={() => setResult(null)}
      />
    </NotificationPromptContext.Provider>
  );
}
