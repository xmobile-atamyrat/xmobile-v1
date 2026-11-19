import StoreBadge from '@/pages/components/StoreBadge';
import { useAppDownloadOs } from '@/pages/lib/appDownload';
import { appDownloadClasses } from '@/styles/classMaps/components/appDownload';
import { fontClassName } from '@/styles/theme';
import { Box, Typography } from '@mui/material';
import { useTranslations } from 'next-intl';

const c = appDownloadClasses.homeBanner;

/**
 * Mobile home's "get the app" card. Only phones in a browser see it (inside
 * the app it would advertise itself). Both badges show, the phone's own first.
 */
export default function AppDownloadBanner() {
  const t = useTranslations();
  const os = useAppDownloadOs();
  if (!os) return null;

  return (
    <Box className={c.wrap}>
      <Box component="aside" className={c.card}>
        <span className={c.glowRed} aria-hidden />
        <span className={c.glowWhite} aria-hidden />
        <Box className={c.row}>
          <img src="/app-download/icon.png" alt="" className={c.icon} />
          <Box className="min-w-0">
            <Typography
              component="h2"
              className={`${fontClassName.className} ${c.title}`}
            >
              {t('appDownloadTitle')}
            </Typography>
            <Typography className={`${fontClassName.className} ${c.subtitle}`}>
              {t('appDownloadSubtitle')}
            </Typography>
          </Box>
        </Box>
        <Box className={c.badgeRow}>
          {(os === 'ios'
            ? (['ios', 'android'] as const)
            : (['android', 'ios'] as const)
          ).map((store) => (
            <StoreBadge key={store} os={store} tone="light" size="sm" />
          ))}
        </Box>
      </Box>
    </Box>
  );
}
