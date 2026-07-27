import Layout from '@/pages/components/Layout';
import { ProfileSkeleton } from '@/pages/components/SkeletonLoader';
import {
  AUTH_REFRESH_COOKIE_NAME,
  LOCALE_COOKIE_NAME,
} from '@/pages/lib/constants';
import {
  FCM_TOKEN_REGISTERED_USER_KEY,
  FCM_TOKEN_STORAGE_KEY,
  unregisterFCMToken,
} from '@/pages/lib/fcm/fcmClient';
import { usePlatform } from '@/pages/lib/PlatformContext';
import { useUserContext } from '@/pages/lib/UserContext';
import { deleteCookie, getCookie, setCookie } from '@/pages/lib/utils';
import { cartIndexClasses } from '@/styles/classMaps/cart';
import { profileClasses } from '@/styles/classMaps/user/profile';
import { colors, fontClassName } from '@/styles/theme';
import {
  Box,
  ButtonBase,
  CardMedia,
  Dialog,
  List,
  ListItemButton,
  Typography,
} from '@mui/material';
import {
  BarChart3,
  ChevronRight,
  Download,
  FolderTree,
  Headphones,
  Images,
  Languages,
  LogIn,
  LogOut,
  Package,
  Palette,
  ScrollText,
  ShieldCheck,
  Trash2,
  Truck,
  Upload,
  User as UserIcon,
} from 'lucide-react';
import { GetStaticProps } from 'next';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/router';
import { ReactNode, useEffect, useState } from 'react';
// getStaticProps because translations are static
export const getStaticProps = (async (context) => {
  return {
    props: {
      messages: (await import(`../../i18n/${context.locale}.json`)).default,
    },
  };
}) satisfies GetStaticProps<object>;

type MenuRow = {
  icon: ReactNode;
  label: string;
  onClick: () => void;
  tone?: 'primary' | 'muted';
};

function MenuCard({ rows }: { rows: MenuRow[] }) {
  return (
    <Box className={profileClasses.card}>
      {rows.map((row, i) => (
        <ButtonBase
          key={row.label}
          onClick={row.onClick}
          disableRipple
          className={`${profileClasses.row} ${
            i < rows.length - 1 ? profileClasses.rowBorder : ''
          }`}
        >
          <span className={profileClasses.rowIcon[row.tone ?? 'primary']}>
            {row.icon}
          </span>
          <span
            className={`${profileClasses.rowLabel} ${fontClassName.className}`}
          >
            {row.label}
          </span>
          <ChevronRight className={profileClasses.chevron} />
        </ButtonBase>
      ))}
    </Box>
  );
}

export default function Profile() {
  const { user, setUser, accessToken, setAccessToken, isLoading } =
    useUserContext();
  const [open, setOpen] = useState(false);
  const [openLang, setOpenLang] = useState(false);
  const [openDeleteAccount, setOpenDeleteAccount] = useState(false);
  const [deleteAccountError, setDeleteAccountError] = useState<string | null>(
    null,
  );
  const [selectedLocale, setSelectedLocale] = useState('ru');
  const router = useRouter();
  const t = useTranslations();
  const platform = usePlatform();
  const lang = [
    { val: 'ru', name: 'Русский', img: '/flags/Russia.png' },
    { val: 'tk', name: 'Türkmençe', img: '/flags/Turkmenistan.png' },
    { val: 'tr', name: 'Türkce', img: '/flags/Turkey.png' },
    { val: 'ch', name: 'Çärjowça', img: '/flags/Turkmenistan.png' },
    { val: 'en', name: 'English', img: '/flags/UnitedKingdom.png' },
  ];
  const isAdmin = user && ['SUPERUSER', 'ADMIN'].includes(user.grade);

  useEffect(() => {
    if (router.locale && router.locale !== router.defaultLocale) {
      setSelectedLocale(router.locale);
    } else {
      setSelectedLocale(
        getCookie(LOCALE_COOKIE_NAME) || router.defaultLocale || 'ru',
      );
    }
  }, [router.locale, router.defaultLocale]);

  const handleToggleLang = () => setOpenLang(!openLang);
  const handleToggle = () => setOpen(!open);
  const handleToggleMyOrders = () =>
    router.push(isAdmin ? '/orders/admin' : '/orders');

  const signOut = async () => {
    try {
      handleToggle();
      if (accessToken) {
        const fcmToken = localStorage.getItem(FCM_TOKEN_STORAGE_KEY);
        if (fcmToken) {
          try {
            await unregisterFCMToken(fcmToken, accessToken);
          } catch (err) {
            console.error('Failed to unregister FCM token', err);
          }
        }
      }
      deleteCookie(AUTH_REFRESH_COOKIE_NAME);
      deleteCookie(LOCALE_COOKIE_NAME);
      setUser(undefined);
      setAccessToken(undefined);
      localStorage.removeItem(FCM_TOKEN_STORAGE_KEY);
      localStorage.removeItem(FCM_TOKEN_REGISTERED_USER_KEY);
    } catch (error) {
      console.error(error);
    }
  };

  const deleteAccount = async () => {
    try {
      const { success }: { success: boolean } = await (
        await fetch('/api/user', {
          method: 'DELETE',
          headers: accessToken
            ? { Authorization: `Bearer ${accessToken}` }
            : undefined,
          credentials: 'include',
        })
      ).json();

      if (!success) {
        setDeleteAccountError('deleteAccountError');
        return;
      }

      setOpenDeleteAccount(false);

      if (accessToken) {
        const fcmToken = localStorage.getItem(FCM_TOKEN_STORAGE_KEY);
        if (fcmToken) {
          try {
            await unregisterFCMToken(fcmToken, accessToken);
          } catch (err) {
            console.error('Failed to unregister FCM token', err);
          }
        }
      }

      deleteCookie(AUTH_REFRESH_COOKIE_NAME);
      deleteCookie(LOCALE_COOKIE_NAME);
      setUser(undefined);
      setAccessToken(undefined);
      localStorage.removeItem(FCM_TOKEN_STORAGE_KEY);
      localStorage.removeItem(FCM_TOKEN_REGISTERED_USER_KEY);
    } catch (error) {
      console.error(error);
      setDeleteAccountError('deleteAccountError');
    }
  };

  if (isLoading) {
    return (
      <Layout handleHeaderBackButton={() => router.push('/')}>
        <Box className={cartIndexClasses.box[platform]}>
          <ProfileSkeleton />
        </Box>
      </Layout>
    );
  }

  const displayName =
    user && user.name.trim() !== '' ? user.name.trim() : t('guest');
  const contact = user?.phoneNumber || user?.email;
  const initials =
    user && user.name.trim() !== ''
      ? user.name
          .trim()
          .split(/\s+/)
          .map((w) => w[0])
          .slice(0, 2)
          .join('')
          .toUpperCase()
      : '';

  const adminRows: MenuRow[] = [
    {
      icon: <Upload className={profileClasses.icon.primary} />,
      label: t('updatePrices'),
      onClick: () => router.push('/product/update-prices'),
    },
    {
      icon: <Palette className={profileClasses.icon.primary} />,
      label: t('updateColors'),
      onClick: () => router.push('/product/update-colors'),
    },
    {
      icon: <FolderTree className={profileClasses.icon.primary} />,
      label: t('categoryHierarchy'),
      onClick: () => router.push('/user/category-hierarchy'),
    },
    {
      icon: <Images className={profileClasses.icon.primary} />,
      label: t('promoBanners'),
      onClick: () => router.push('/admin/banners'),
    },
    {
      icon: <BarChart3 className={profileClasses.icon.primary} />,
      label: t('analytics'),
      onClick: () => router.push('/analytics'),
    },
    {
      icon: <ScrollText className={profileClasses.icon.primary} />,
      label: t('serverLogs'),
      onClick: () => router.push('/server-logs'),
    },
    ...(user?.grade === 'SUPERUSER'
      ? [
          {
            icon: <Truck className={profileClasses.icon.primary} />,
            label: t('procurement'),
            onClick: () => router.push('/procurement'),
          },
          {
            icon: <Download className={profileClasses.icon.primary} />,
            label: t('appVersions'),
            onClick: () => router.push('/admin/app-version'),
          },
        ]
      : []),
  ];

  const accountRows: MenuRow[] = [
    ...(user
      ? [
          {
            icon: <Package className={profileClasses.icon.primary} />,
            label: isAdmin ? t('userOrders') : t('myOrders'),
            onClick: handleToggleMyOrders,
          },
        ]
      : [
          {
            icon: <LogIn className={profileClasses.icon.primary} />,
            label: t('signin'),
            onClick: () => router.push('/user/sign_in_up'),
          },
        ]),
    {
      icon: <Languages className={profileClasses.icon.primary} />,
      label: t('appLanguage'),
      onClick: handleToggleLang,
    },
  ];

  const moreRows: MenuRow[] = [
    {
      icon: <Headphones className={profileClasses.icon.muted} />,
      label: t('supportTitle'),
      onClick: () => router.push('/support'),
      tone: 'muted',
    },
    {
      icon: <ShieldCheck className={profileClasses.icon.muted} />,
      label: t('privacyPolicyTitle'),
      onClick: () => router.push('/privacy-policy'),
      tone: 'muted',
    },
  ];

  return (
    <Layout handleHeaderBackButton={() => router.push('/')}>
      <Box className={profileClasses.page[platform]}>
        <Box className={profileClasses.header[platform]}>
          <Typography
            className={`${profileClasses.headerTitle} ${fontClassName.className}`}
          >
            {t('account')}
          </Typography>
          <Box className={profileClasses.avatarRow}>
            <Box className={profileClasses.avatar}>
              {initials ? (
                <span
                  className={`${profileClasses.avatarTxt} ${fontClassName.className}`}
                >
                  {initials}
                </span>
              ) : (
                <UserIcon className={profileClasses.avatarIcon} />
              )}
            </Box>
            <Box>
              <Typography
                className={`${profileClasses.name} ${fontClassName.className}`}
              >
                {displayName}
              </Typography>
              {contact && (
                <Typography
                  className={`${profileClasses.contact} ${fontClassName.className}`}
                >
                  {contact}
                </Typography>
              )}
            </Box>
          </Box>
        </Box>

        <Box className={profileClasses.content[platform]}>
          <MenuCard rows={accountRows} />
          {isAdmin && <MenuCard rows={adminRows} />}
          <MenuCard rows={moreRows} />

          {user && (
            <>
              <ButtonBase
                disableRipple
                onClick={handleToggle}
                className={`${profileClasses.logout} ${fontClassName.className}`}
              >
                <LogOut className="w-[18px] h-[18px]" />
                {t('signout')}
              </ButtonBase>
              <ButtonBase
                disableRipple
                onClick={() => {
                  setDeleteAccountError(null);
                  setOpenDeleteAccount(true);
                }}
                className={`${profileClasses.deleteBtn} ${fontClassName.className}`}
              >
                <Trash2 className="w-[15px] h-[15px]" />
                {t('deleteAccount')}
              </ButtonBase>
            </>
          )}
        </Box>

        <Dialog
          open={open}
          onClose={handleToggle}
          PaperProps={{ className: profileClasses.dialog.main[platform] }}
        >
          <Box className="flex flex-col w-full">
            <Typography
              className={`${profileClasses.dialogTitle} ${fontClassName.className}`}
            >
              {t('signout')}
            </Typography>
            <Box className={profileClasses.dialogBody}>
              <Typography
                className={`${profileClasses.dialogText} ${fontClassName.className}`}
              >
                {t('signOutVerify')}
              </Typography>
            </Box>
            <Box className={profileClasses.dialogActions}>
              <ButtonBase
                disableRipple
                onClick={handleToggle}
                className={`${profileClasses.dialogOption} ${profileClasses.dialogCancel} ${fontClassName.className}`}
              >
                {t('no')}
              </ButtonBase>
              <ButtonBase
                disableRipple
                onClick={signOut}
                className={`${profileClasses.dialogOption} ${profileClasses.dialogConfirm} ${fontClassName.className}`}
              >
                {t('yes')}
              </ButtonBase>
            </Box>
          </Box>
        </Dialog>

        <Dialog
          open={openDeleteAccount}
          onClose={() => setOpenDeleteAccount(false)}
          PaperProps={{ className: profileClasses.dialog.main[platform] }}
        >
          <Box className="flex flex-col w-full">
            <Typography
              className={`${profileClasses.dialogTitle} ${fontClassName.className} !text-red`}
            >
              {t('deleteAccount')}
            </Typography>
            <Box className={profileClasses.dialogBody}>
              <Typography
                className={`${profileClasses.dialogText} ${fontClassName.className}`}
              >
                {t('deleteAccountVerify')}
              </Typography>
            </Box>
            {deleteAccountError && (
              <Box className="flex justify-center mt-[8px]">
                <Typography
                  className={`${fontClassName.className} text-center text-[13px] text-red`}
                >
                  {t(deleteAccountError)}
                </Typography>
              </Box>
            )}
            <Box className={profileClasses.dialogActions}>
              <ButtonBase
                disableRipple
                onClick={() => setOpenDeleteAccount(false)}
                className={`${profileClasses.dialogOption} ${profileClasses.dialogCancel} ${fontClassName.className}`}
              >
                {t('no')}
              </ButtonBase>
              <ButtonBase
                disableRipple
                onClick={deleteAccount}
                className={`${profileClasses.dialogOption} ${profileClasses.dialogConfirm} ${fontClassName.className}`}
              >
                {t('yes')}
              </ButtonBase>
            </Box>
          </Box>
        </Dialog>

        <Dialog
          open={openLang}
          onClose={handleToggleLang}
          PaperProps={{
            className: `${profileClasses.dialog.main[platform]} !block`,
          }}
        >
          <Typography
            className={`${profileClasses.dialogTitle} ${fontClassName.className}`}
          >
            {t('appLanguage')}
          </Typography>
          <List className={profileClasses.langList}>
            {lang.map((language) => (
              <ListItemButton
                className={profileClasses.langListItem}
                key={language.val}
                selected={selectedLocale === language.val}
                onClick={() => {
                  const newLocale = language.val;
                  setSelectedLocale(newLocale);
                  setCookie(LOCALE_COOKIE_NAME, newLocale);
                  router.push(router.pathname, router.asPath, {
                    locale: newLocale,
                  });
                  handleToggleLang();
                }}
                sx={{
                  '&.Mui-selected': {
                    backgroundColor: colors.paperBackground.web,
                  },
                }}
              >
                <Box className={profileClasses.langOptionRow}>
                  <CardMedia
                    component="img"
                    src={language.img}
                    className={profileClasses.langImg}
                  />
                  <Typography
                    className={`${profileClasses.langOptionTxt} ${fontClassName.className}`}
                  >
                    {language.name}
                  </Typography>
                </Box>
              </ListItemButton>
            ))}
          </List>
        </Dialog>
      </Box>
    </Layout>
  );
}
