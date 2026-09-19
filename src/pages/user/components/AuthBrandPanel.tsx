import { authPanelClasses } from '@/styles/classMaps/user/authPanel';
import { fontClassName } from '@/styles/theme';
import { Box, CardMedia, Typography } from '@mui/material';
import { Banknote, ShieldCheck, Truck } from 'lucide-react';
import { useTranslations } from 'next-intl';

const features = [
  { icon: Truck, key: 'nationwideDelivery' },
  { icon: ShieldCheck, key: 'officialWarranty' },
  { icon: Banknote, key: 'cashOnDelivery' },
] as const;

/**
 * Navy gradient half of the web sign-in / sign-up split screen
 * (XMobile.dc.html:2117-2121, 2147-2152). Web-only: rendered behind a
 * `platform === 'web'` guard by the caller rather than a Tailwind `md:` prefix,
 * because `usePlatform()` switches at MUI's md (900px), not Tailwind's (768px).
 *
 * The mockup's third bullet is "Pay in 4 · 0% instalments"; there is no
 * instalment feature (COD is the only payment method), so it carries the real
 * `cashOnDelivery` promise instead. Same reason the sign-up panel's
 * "Get 500 TMT off your first order" promo is not here — no coupon model.
 */
export default function AuthBrandPanel({
  reversed = false,
}: {
  reversed?: boolean;
}) {
  const t = useTranslations();

  return (
    <Box
      className={`${authPanelClasses.panel} ${
        reversed
          ? authPanelClasses.gradient.reversed
          : authPanelClasses.gradient.normal
      }`}
    >
      <CardMedia
        component="img"
        src="/logo/xmobile-processed-logo.png"
        alt="XMobile"
        className={authPanelClasses.logo}
      />
      <Typography
        className={`${authPanelClasses.title} ${fontClassName.className}`}
      >
        {t('welcomeToXmobile')}
      </Typography>
      <Typography
        className={`${authPanelClasses.subtitle} ${fontClassName.className}`}
      >
        {t('signInUpSubtitle')}
      </Typography>
      <Box className={authPanelClasses.features}>
        {features.map(({ icon: Icon, key }) => (
          <span
            key={key}
            className={`${authPanelClasses.feature} ${fontClassName.className}`}
          >
            <Icon size={20} className="flex-shrink-0" />
            {t(key)}
          </span>
        ))}
      </Box>
    </Box>
  );
}
