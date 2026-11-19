import {
  hasNativeAppBanner,
  storeUrlFor,
  useAppDownloadOs,
} from '@/pages/lib/appDownload';
import { appDownloadClasses } from '@/styles/classMaps/components/appDownload';
import { fontClassName } from '@/styles/theme';
import { Box } from '@mui/material';
import { X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { startTransition, useEffect, useState } from 'react';

const c = appDownloadClasses.installBar;

export const INSTALL_BAR_DISMISSED_KEY = 'appInstallBarDismissedAt';
const DISMISS_FOR_MS = 30 * 24 * 60 * 60 * 1000;

function wasDismissedRecently(): boolean {
  try {
    const at = Number(localStorage.getItem(INSTALL_BAR_DISMISSED_KEY));
    return at > 0 && Date.now() - at < DISMISS_FOR_MS;
  } catch {
    // storage blocked (private mode): show the bar, closing still hides it
    return false;
  }
}

/**
 * Slim "open in the app" bar above the mobile header. It scrolls away with the
 * page, and closing it keeps it hidden for 30 days. Skipped where Safari
 * already shows its own banner for the same app.
 */
export default function AppInstallBar() {
  const t = useTranslations();
  const os = useAppDownloadOs();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!os) return;
    const show =
      !hasNativeAppBanner(navigator.userAgent, os) && !wasDismissedRecently();
    startTransition(() => setVisible(show));
  }, [os]);

  if (!os || !visible) return null;

  const dismiss = () => {
    setVisible(false);
    try {
      localStorage.setItem(INSTALL_BAR_DISMISSED_KEY, String(Date.now()));
    } catch {
      // closed for this page view only
    }
  };

  return (
    <Box
      component="aside"
      className={`${fontClassName.className} ${c.bar}`}
      aria-label={t('appDownloadTitle')}
    >
      <button
        type="button"
        onClick={dismiss}
        aria-label={t('close')}
        className={c.close}
      >
        <X size={18} />
      </button>
      <img src="/app-download/icon.png" alt="" className={c.icon} />
      <Box className={c.textCol}>
        <span className={c.title}>Xmobile</span>
        <span className={c.subtitle}>{t('appInstallBarSubtitle')}</span>
      </Box>
      <a
        href={storeUrlFor(os)}
        target="_blank"
        rel="noopener noreferrer"
        className={c.cta}
      >
        {t('appInstall')}
      </a>
    </Box>
  );
}
