import Layout from '@/pages/components/Layout';
import { ProfileSkeleton } from '@/pages/components/SkeletonLoader';
import {
  LOCALE_COOKIE_NAME,
  mobileBottomNavHeight,
} from '@/pages/lib/constants';
import {
  disableNotifications,
  enableNotifications,
  isNotificationsEnabled,
} from '@/pages/lib/fcm/fcmClient';
import { usePlatform } from '@/pages/lib/PlatformContext';
import { clearSessionOnDevice } from '@/pages/lib/signOut';
import { useUserContext } from '@/pages/lib/UserContext';
import { getCookie, setCookie } from '@/pages/lib/utils';
import AccountNav from '@/pages/user/components/AccountNav';
import { cartIndexClasses } from '@/styles/classMaps/cart';
import { profileClasses } from '@/styles/classMaps/user/profile';
import { snackbarClasses } from '@/styles/classMaps/components/snackbar';
import { fontClassName, navy } from '@/styles/theme';
import {
  Box,
  ButtonBase,
  CardMedia,
  Dialog,
  Snackbar,
  Switch,
  Typography,
} from '@mui/material';
import {
  AlertTriangle,
  BarChart3,
  Bell,
  Check,
  ChevronRight,
  Download,
  FolderTree,
  Headphones,
  Images,
  Languages,
  LogOut,
  Package,
  Palette,
  ScrollText,
  ShieldCheck,
  Trash2,
  Truck,
  Upload,
  User as UserIcon,
  X,
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
  onClick?: () => void;
  tone?: 'primary' | 'muted';
  value?: string;
  toggle?: { checked: boolean; onChange: () => void };
};

const navySwitchSx = {
  '& .MuiSwitch-switchBase.Mui-checked': { color: '#fff' },
  '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': {
    backgroundColor: navy,
    opacity: 1,
  },
};

// `web` drops the 38px icon tile and the hairline row dividers so the rows read
// as one language with the nav rail beside them (spec 1745-1755).
function MenuCard({
  rows,
  variant = 'mobile',
}: {
  rows: MenuRow[];
  variant?: 'mobile' | 'web';
}) {
  const isWeb = variant === 'web';
  return (
    <Box className={isWeb ? profileClasses.web.card : profileClasses.card}>
      {rows.map((row, i) => {
        const borderCls =
          !isWeb && i < rows.length - 1 ? profileClasses.rowBorder : '';
        const rowCls = `${isWeb ? profileClasses.web.row : profileClasses.row} ${borderCls}`;
        const inner = (
          <>
            {isWeb ? (
              row.icon
            ) : (
              <span className={profileClasses.rowIcon[row.tone ?? 'primary']}>
                {row.icon}
              </span>
            )}
            <span
              className={`${
                isWeb ? profileClasses.web.rowLabel : profileClasses.rowLabel
              } ${fontClassName.className}`}
            >
              {row.label}
            </span>
            {row.value && (
              <span
                className={`${profileClasses.rowValue} ${fontClassName.className}`}
              >
                {row.value}
              </span>
            )}
            {row.toggle ? (
              <Switch
                checked={row.toggle.checked}
                onChange={row.toggle.onChange}
                sx={navySwitchSx}
              />
            ) : (
              <ChevronRight className={profileClasses.chevron} />
            )}
          </>
        );

        return row.toggle ? (
          <Box key={row.label} className={rowCls}>
            {inner}
          </Box>
        ) : (
          <ButtonBase
            key={row.label}
            onClick={row.onClick}
            disableRipple
            className={rowCls}
          >
            {inner}
          </ButtonBase>
        );
      })}
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
  const [pendingLocale, setPendingLocale] = useState('ru');
  const [notifEnabled, setNotifEnabled] = useState(false);
  const [notifBusy, setNotifBusy] = useState(false);
  const [notifDenied, setNotifDenied] = useState(false);
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

  // Reflect the current device's notification state (token registered = on).
  useEffect(() => {
    setNotifEnabled(user ? isNotificationsEnabled() : false);
  }, [user]);

  const handleToggleNotif = async () => {
    if (!user || !accessToken || notifBusy) return;
    setNotifBusy(true);
    try {
      if (notifEnabled) {
        await disableNotifications(accessToken);
        setNotifEnabled(false);
      } else {
        const ok = await enableNotifications(accessToken, user.id);
        setNotifEnabled(ok);
        if (!ok) setNotifDenied(true);
      }
    } finally {
      setNotifBusy(false);
    }
  };

  const handleToggleLang = () => {
    setPendingLocale(selectedLocale);
    setOpenLang(true);
  };
  const applyLang = () => {
    setSelectedLocale(pendingLocale);
    setCookie(LOCALE_COOKIE_NAME, pendingLocale);
    router.push(router.pathname, router.asPath, { locale: pendingLocale });
    setOpenLang(false);
  };
  const handleToggle = () => setOpen(!open);
  const handleToggleMyOrders = () =>
    router.push(isAdmin ? '/orders/admin' : '/orders');

  const signOut = async () => {
    try {
      handleToggle();
      await clearSessionOnDevice(accessToken);
      setUser(undefined);
      setAccessToken(undefined);
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

      await clearSessionOnDevice(accessToken);
      setUser(undefined);
      setAccessToken(undefined);
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

  const currentLangName = lang.find((l) => l.val === selectedLocale)?.name;

  const accountRows: MenuRow[] = [
    {
      icon: <Package className={profileClasses.icon.primary} />,
      label: isAdmin ? t('userOrders') : t('myOrders'),
      onClick: handleToggleMyOrders,
    },
    {
      icon: <Bell className={profileClasses.icon.primary} />,
      label: t('notifications'),
      toggle: {
        checked: notifEnabled,
        onChange: handleToggleNotif,
      },
    },
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

  // Guest: single "General" card (mockup XMobile.dc.html:954-959).
  const guestRows: MenuRow[] = [
    {
      icon: <Headphones className={profileClasses.icon.muted} />,
      label: t('supportTitle'),
      onClick: () => router.push('/support'),
      tone: 'muted',
    },
    {
      icon: <Languages className={profileClasses.icon.muted} />,
      label: t('appLanguage'),
      onClick: handleToggleLang,
      tone: 'muted',
      value: currentLangName,
    },
    {
      icon: <ShieldCheck className={profileClasses.icon.muted} />,
      label: t('privacyPolicyTitle'),
      onClick: () => router.push('/privacy-policy'),
      tone: 'muted',
    },
  ];

  // Sign out / delete account / language + the permission snackbar. Shared by
  // both platform branches — Dialogs and Snackbars render in a portal, so where
  // they sit in the tree is inert.
  const overlays = (
    <>
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
        onClose={() => setOpenLang(false)}
        sx={
          platform === 'mobile'
            ? { '& .MuiDialog-container': { alignItems: 'flex-end' } }
            : undefined
        }
        PaperProps={{
          className: profileClasses.langSheet[platform],
          sx: { m: 0, maxWidth: 'none' },
        }}
      >
        {platform === 'mobile' && <Box className={profileClasses.langHandle} />}
        <Box className={profileClasses.langHeader}>
          <Typography
            className={`${profileClasses.langTitle} ${fontClassName.className}`}
          >
            {t('appLanguage')}
          </Typography>
          <ButtonBase
            disableRipple
            onClick={() => setOpenLang(false)}
            className={profileClasses.langClose}
          >
            <X className={profileClasses.langCloseIcon} />
          </ButtonBase>
        </Box>
        <Box className={profileClasses.langOptions}>
          {lang.map((language) => {
            const active = pendingLocale === language.val;
            return (
              <ButtonBase
                key={language.val}
                disableRipple
                onClick={() => setPendingLocale(language.val)}
                className={`${profileClasses.langRow} ${
                  active
                    ? profileClasses.langRowActive
                    : profileClasses.langRowIdle
                }`}
              >
                <CardMedia
                  component="img"
                  src={language.img}
                  className={profileClasses.langImg}
                />
                <Typography
                  className={`${profileClasses.langRowName} ${
                    active ? 'font-semibold' : 'font-medium'
                  } ${fontClassName.className}`}
                >
                  {language.name}
                </Typography>
                <Box
                  className={`${profileClasses.langRadio} ${
                    active
                      ? profileClasses.langRadioActive
                      : profileClasses.langRadioIdle
                  }`}
                >
                  {active && <Check className={profileClasses.langRadioIcon} />}
                </Box>
              </ButtonBase>
            );
          })}
        </Box>
        <ButtonBase
          disableRipple
          onClick={applyLang}
          className={`${profileClasses.langApply} ${fontClassName.className}`}
        >
          {t('apply')}
        </ButtonBase>
      </Dialog>

      <Snackbar
        open={notifDenied}
        autoHideDuration={4000}
        disableWindowBlurListener
        onClose={() => setNotifDenied(false)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        sx={{ bottom: `${mobileBottomNavHeight + 8}px !important` }}
      >
        <Box className={snackbarClasses.pill}>
          <AlertTriangle className={snackbarClasses.icon.warning} size={20} />
          <Typography
            className={`${fontClassName.className} ${snackbarClasses.message}`}
          >
            {t('notificationsDenied')}
          </Typography>
        </Box>
      </Snackbar>
    </>
  );

  // Desktop account (spec 1725-1790): the nav rail owns My orders / Support /
  // Privacy / Sign out, so this column keeps only what the rail can't hold —
  // preferences, the admin tools and the destructive action.
  if (platform === 'web') {
    const webPreferenceRows = accountRows.filter(
      (row) => row.label !== t('myOrders') && row.label !== t('userOrders'),
    );

    return (
      <Layout handleHeaderBackButton={() => router.push('/')}>
        <Box className={profileClasses.web.grid}>
          <AccountNav active="account" />
          <Box className={profileClasses.web.col}>
            <Typography
              className={`${profileClasses.web.title} ${fontClassName.className}`}
            >
              {t('account')}
            </Typography>
            {user ? (
              <>
                <MenuCard variant="web" rows={webPreferenceRows} />
                {isAdmin && <MenuCard variant="web" rows={adminRows} />}
                <ButtonBase
                  disableRipple
                  onClick={() => {
                    setDeleteAccountError(null);
                    setOpenDeleteAccount(true);
                  }}
                  className={`${profileClasses.web.deleteBtn} ${fontClassName.className}`}
                >
                  <Trash2 className="w-[15px] h-[15px]" />
                  {t('deleteAccount')}
                </ButtonBase>
              </>
            ) : (
              <>
                <Box className={profileClasses.web.heroCard}>
                  <Typography
                    className={`${profileClasses.heroTitle} ${fontClassName.className}`}
                  >
                    {t('browsingAsGuest')}
                  </Typography>
                  <Typography
                    className={`${profileClasses.heroSubtitle} ${fontClassName.className}`}
                  >
                    {t('signInUpSubtitle')}
                  </Typography>
                  <Box className={profileClasses.web.heroActions}>
                    <ButtonBase
                      disableRipple
                      onClick={() => router.push('/user/signin')}
                      className={`${profileClasses.heroSignIn} !mb-0 ${fontClassName.className}`}
                    >
                      {t('signin')}
                    </ButtonBase>
                    <ButtonBase
                      disableRipple
                      onClick={() => router.push('/user/signup')}
                      className={`${profileClasses.heroCreate} ${fontClassName.className}`}
                    >
                      {t('createAccount')}
                    </ButtonBase>
                  </Box>
                </Box>
                <MenuCard variant="web" rows={guestRows} />
              </>
            )}
          </Box>
        </Box>
        {overlays}
      </Layout>
    );
  }

  return (
    <Layout handleHeaderBackButton={() => router.push('/')}>
      <Box className={profileClasses.page[platform]}>
        {user ? (
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
        ) : (
          <Box className={profileClasses.guestHeader[platform]}>
            <Typography
              className={`${profileClasses.guestTitle} ${fontClassName.className}`}
            >
              {t('account')}
            </Typography>
          </Box>
        )}

        <Box className={profileClasses.content[platform]}>
          {user ? (
            <>
              <MenuCard rows={accountRows} />
              {isAdmin && <MenuCard rows={adminRows} />}
              <MenuCard rows={moreRows} />
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
          ) : (
            <>
              <Box className={profileClasses.heroCard}>
                <Box className={profileClasses.heroAvatar}>
                  <UserIcon className={profileClasses.heroAvatarIcon} />
                </Box>
                <Typography
                  className={`${profileClasses.heroTitle} ${fontClassName.className}`}
                >
                  {t('browsingAsGuest')}
                </Typography>
                <Typography
                  className={`${profileClasses.heroSubtitle} ${fontClassName.className}`}
                >
                  {t('signInUpSubtitle')}
                </Typography>
                <ButtonBase
                  disableRipple
                  onClick={() => router.push('/user/signin')}
                  className={`${profileClasses.heroSignIn} ${fontClassName.className}`}
                >
                  {t('signin')}
                </ButtonBase>
                <ButtonBase
                  disableRipple
                  onClick={() => router.push('/user/signup')}
                  className={`${profileClasses.heroCreate} ${fontClassName.className}`}
                >
                  {t('createAccount')}
                </ButtonBase>
              </Box>
              <Typography
                className={`${profileClasses.sectionLabel} ${fontClassName.className}`}
              >
                {t('general')}
              </Typography>
              <MenuCard rows={guestRows} />
            </>
          )}
        </Box>
      </Box>
      {overlays}
    </Layout>
  );
}
