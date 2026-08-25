import { useCategoryContext } from '@/pages/lib/CategoryContext';
import { usePlatform } from '@/pages/lib/PlatformContext';
import { useProductContext } from '@/pages/lib/ProductContext';
import { ExtendedCategory } from '@/pages/lib/types';
import { parseName } from '@/pages/lib/utils';
import { footerClasses } from '@/styles/classMaps/components/footer';
import { fontClassName } from '@/styles/theme';
// lucide 1.x dropped brand glyphs, so Instagram stays on the MUI icon.
import InstagramIcon from '@mui/icons-material/Instagram';
import { Box, CardMedia, Typography } from '@mui/material';
import {
  Banknote,
  Clock,
  Headset,
  Home,
  LayoutGrid,
  Mail,
  MapPin,
  Phone,
  Search,
  ShieldCheck,
  ShoppingBag,
  Truck,
  User,
} from 'lucide-react';
import { GetServerSideProps } from 'next';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useRouter } from 'next/router';

export const getServerSideProps: GetServerSideProps = async (context) => {
  return {
    props: {
      messages: (await import(`../../i18n/${context.locale}.json`)).default,
    },
  };
};

const phoneNumbers = ['+99361004933', '+99371211717', '+99342230620'];
const supportEmail = 'xmobiletm@gmail.com';
const mapsUrl = 'https://maps.app.goo.gl/sYc6VJSSFJW1aUd76';

const navItems = [
  { href: '/', labelKey: 'home', Icon: Home },
  { href: '/category', labelKey: 'categories', Icon: LayoutGrid },
  { href: '/search', labelKey: 'searchNav', Icon: Search },
  { href: '/cart', labelKey: 'cart', Icon: ShoppingBag },
  { href: '/user', labelKey: 'profileNav', Icon: User },
] as const;

// The design's footer link columns; only routes that actually exist.
const helpLinks = [
  { href: '/orders', labelKey: 'myOrders' },
  { href: '/support', labelKey: 'supportTitle' },
  { href: '/chat', labelKey: 'chatSupportChat' },
  { href: '/privacy-policy', labelKey: 'privacyPolicyTitle' },
] as const;

const web = footerClasses.web;

export default function Footer() {
  const t = useTranslations();
  const platform = usePlatform();
  const router = useRouter();
  const { categories: allCategories, setSelectedCategoryId } =
    useCategoryContext();
  const { setProducts } = useProductContext();

  const goTo = (href: string) => {
    router.push(href, href, { locale: router.locale });
    setProducts([]);
    setSelectedCategoryId(undefined);
  };

  // Same branch the appbar/categories index use: leaf categories go straight to
  // the product listing, parents open the sub-category page.
  const goToCategory = (category: ExtendedCategory) => {
    setProducts([]);
    setSelectedCategoryId(category.id);
    router.push(
      category.successorCategories == null ||
        category.successorCategories.length === 0
        ? `/product-category/${category.slug}`
        : `/category/${category.slug}`,
    );
  };

  // Real store promises only — the design's "14-day returns" / "Pay in 4" have
  // no backing feature. Home already renders this exact strip mid-page (step
  // 52), so it is dropped there rather than shown twice on one screen.
  const trustItems = [
    {
      Icon: Truck,
      title: t('nationwideDelivery'),
      subtitle: t('nationwideDeliverySub'),
    },
    {
      Icon: ShieldCheck,
      title: t('officialWarranty'),
      subtitle: t('officialWarrantySub'),
    },
    { Icon: Banknote, title: t('cashOnDelivery'), subtitle: t('payInCash') },
    {
      Icon: Headset,
      title: t('chatCustomerSupport'),
      subtitle: `${t('supportHoursDays')}, ${t('supportHoursTime')}`,
    },
  ];
  const showTrustStrip = router.pathname !== '/';

  return (
    <Box className={footerClasses.boxes.main[platform]}>
      <Box
        component="nav"
        sx={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: 1000,
        }}
        className={footerClasses.boxes.mainMobile[platform]}
      >
        <Box className={footerClasses.boxes.bottomNavigation}>
          {navItems.map(({ href, labelKey, Icon }) => {
            const active = router.pathname === href;
            return (
              <button
                key={href}
                type="button"
                onClick={() => goTo(href)}
                className={`${footerClasses.navItem.wrapper} ${
                  active
                    ? footerClasses.navItem.active
                    : footerClasses.navItem.inactive
                }`}
              >
                <Icon
                  className={footerClasses.navItem.icon}
                  strokeWidth={1.75}
                />
                <span
                  className={`${fontClassName.className} ${
                    active
                      ? footerClasses.navItem.labelActive
                      : footerClasses.navItem.labelInactive
                  }`}
                >
                  {t(labelKey)}
                </span>
              </button>
            );
          })}
        </Box>
      </Box>

      {/* ---- Web footer (spec 2291-2317) ---- */}
      <Box className={footerClasses.boxes.mainWeb[platform]}>
        {showTrustStrip && (
          <Box className={web.trustRow}>
            {trustItems.map(({ Icon, title, subtitle }) => (
              <Box key={title} className={web.trustItem}>
                <Box className={web.trustIcon}>
                  <Icon size={22} strokeWidth={1.75} />
                </Box>
                <Box>
                  <Typography
                    className={`${fontClassName.className} ${web.trustTitle}`}
                  >
                    {title}
                  </Typography>
                  <Typography
                    className={`${fontClassName.className} ${web.trustSub}`}
                  >
                    {subtitle}
                  </Typography>
                </Box>
              </Box>
            ))}
          </Box>
        )}

        <Box className={web.columns}>
          {/* brand */}
          <Box>
            <Link href="/">
              <CardMedia
                component="img"
                image="/logo/xmobile-processed-logo.png"
                alt="Logo"
                className={web.brandLogo}
              />
            </Link>
            <Typography className={`${fontClassName.className} ${web.tagline}`}>
              {t('footerTagline')}
            </Typography>
            <Box className={web.socialRow}>
              <a
                href="https://www.instagram.com/xmobiletm/"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Instagram"
                className={web.socialButton}
              >
                <InstagramIcon className="w-[18px] h-[18px]" />
              </a>
              <a
                href="https://www.tiktok.com/@xmobiletm/"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="TikTok"
                className={web.socialButton}
              >
                <CardMedia
                  component="img"
                  src="/icons/tiktok.png"
                  className="w-auto h-[17px] invert brightness-0"
                />
              </a>
            </Box>
          </Box>

          {/* categories */}
          <Box>
            <Typography
              className={`${fontClassName.className} ${web.colTitle}`}
            >
              {t('categories')}
            </Typography>
            <Box className={web.colList}>
              {allCategories.slice(0, 6).map((category) => (
                <button
                  key={category.id}
                  type="button"
                  onClick={() => goToCategory(category)}
                  className={`${fontClassName.className} ${web.colLink}`}
                >
                  {parseName(category.name, router.locale ?? 'tk')}
                </button>
              ))}
              <button
                type="button"
                onClick={() => goTo('/category')}
                className={`${fontClassName.className} ${web.colLink}`}
              >
                {t('allCategory')}
              </button>
            </Box>
          </Box>

          {/* help */}
          <Box>
            <Typography
              className={`${fontClassName.className} ${web.colTitle}`}
            >
              {t('help')}
            </Typography>
            <Box className={web.colList}>
              {helpLinks.map(({ href, labelKey }) => (
                <Link
                  key={href}
                  href={href}
                  className={`${fontClassName.className} ${web.colLink}`}
                >
                  {t(labelKey)}
                </Link>
              ))}
            </Box>
          </Box>

          {/* contact — replaces the design's newsletter/app-store column, which
              has no backing endpoint or store listing */}
          <Box>
            <Typography
              className={`${fontClassName.className} ${web.colTitle}`}
            >
              {t('contact')}
            </Typography>
            <Box className={web.contactList}>
              <Box className={web.contactRow}>
                <Phone className={web.contactIcon} strokeWidth={1.75} />
                <Box className={web.contactStack}>
                  {phoneNumbers.map((phone) => (
                    <a
                      key={phone}
                      href={`tel:${phone}`}
                      className={`${fontClassName.className} ${web.contactLink}`}
                    >
                      {phone}
                    </a>
                  ))}
                </Box>
              </Box>
              <Box className={web.contactRow}>
                <Mail className={web.contactIcon} strokeWidth={1.75} />
                <a
                  href={`mailto:${supportEmail}`}
                  className={`${fontClassName.className} ${web.contactLink}`}
                >
                  {supportEmail}
                </a>
              </Box>
              <Box className={web.contactRow}>
                <MapPin className={web.contactIcon} strokeWidth={1.75} />
                <a
                  href={mapsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`${fontClassName.className} ${web.contactLink}`}
                >
                  {t('address')}
                </a>
              </Box>
              <Box className={web.contactRow}>
                <Clock className={web.contactIcon} strokeWidth={1.75} />
                <Typography
                  className={`${fontClassName.className} ${web.contactText}`}
                >
                  {t('supportHoursDays')}, {t('supportHoursTime')}
                </Typography>
              </Box>
            </Box>
          </Box>
        </Box>

        <Box className={web.bottomBar}>
          <Typography className={`${fontClassName.className} ${web.copyright}`}>
            Xmobile © {new Date().getFullYear()}. All Rights Reserved. ·{' '}
            {t('pricesInTmt')}
          </Typography>
          <Box className={web.bottomRight}>
            <Link
              href="/privacy-policy"
              className={`${fontClassName.className} ${web.bottomLink}`}
            >
              {t('privacyPolicyTitle')}
            </Link>
            <Link
              href="/support"
              className={`${fontClassName.className} ${web.bottomLink}`}
            >
              {t('supportTitle')}
            </Link>
            <Typography
              className={`${fontClassName.className} ${web.payBadge}`}
            >
              {t('cashOnDelivery')}
            </Typography>
          </Box>
        </Box>
      </Box>
    </Box>
  );
}
