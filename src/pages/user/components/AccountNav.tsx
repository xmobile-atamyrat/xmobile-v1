import { clearSessionOnDevice } from '@/pages/lib/signOut';
import { useUserContext } from '@/pages/lib/UserContext';
import { accountNavClasses } from '@/styles/classMaps/user/accountNav';
import { profileClasses } from '@/styles/classMaps/user/profile';
import { fontClassName } from '@/styles/theme';
import { Box, ButtonBase, Dialog, Typography } from '@mui/material';
import {
  Headphones,
  LogIn,
  LogOut,
  Package,
  ShieldCheck,
  User as UserIcon,
  UserCog,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/router';
import { ReactNode, useState } from 'react';

/**
 * Left account nav rail for the desktop account section (spec 1745-1755),
 * shared by `/user`, `/orders` and `/orders/[id]` on web.
 *
 * Every row is a real destination. The mockup's Wishlist / Addresses / Payment
 * methods / Settings rows are skipped: there is no `Wishlist` model, no address
 * book (`User.address` is one free-text string), COD is the only payment
 * method, and there is no settings surface (plan step 42).
 */
export type AccountNavSection = 'orders' | 'account';

interface NavRow {
  key: AccountNavSection | 'support' | 'privacy';
  icon: ReactNode;
  label: string;
  onClick: () => void;
}

export default function AccountNav({ active }: { active: AccountNavSection }) {
  const router = useRouter();
  const t = useTranslations();
  const { user, accessToken, setUser, setAccessToken } = useUserContext();
  const [signOutOpen, setSignOutOpen] = useState(false);

  const isAdmin = user != null && ['SUPERUSER', 'ADMIN'].includes(user.grade);
  const displayName =
    user && user.name.trim() !== '' ? user.name.trim() : t('guest');
  const contact = user?.phoneNumber || user?.email;
  const initials =
    user && user.name.trim() !== ''
      ? user.name
          .trim()
          .split(/\s+/)
          .map((word) => word[0])
          .slice(0, 2)
          .join('')
          .toUpperCase()
      : '';

  const iconCls = (rowActive: boolean) =>
    `${accountNavClasses.icon} ${
      rowActive ? accountNavClasses.iconActive : accountNavClasses.iconIdle
    }`;

  const rows: NavRow[] = [
    {
      key: 'orders',
      icon: <Package className={iconCls(active === 'orders')} />,
      label: isAdmin ? t('userOrders') : t('myOrders'),
      onClick: () => router.push(isAdmin ? '/orders/admin' : '/orders'),
    },
    {
      key: 'account',
      icon: <UserCog className={iconCls(active === 'account')} />,
      label: t('account'),
      onClick: () => router.push('/user'),
    },
    {
      key: 'support',
      icon: <Headphones className={iconCls(false)} />,
      label: t('supportTitle'),
      onClick: () => router.push('/support'),
    },
    {
      key: 'privacy',
      icon: <ShieldCheck className={iconCls(false)} />,
      label: t('privacyPolicyTitle'),
      onClick: () => router.push('/privacy-policy'),
    },
  ];

  const signOut = async () => {
    setSignOutOpen(false);
    try {
      await clearSessionOnDevice(accessToken);
      setUser(undefined);
      setAccessToken(undefined);
    } catch (error) {
      console.error(error);
    }
  };

  return (
    <Box className={accountNavClasses.rail}>
      <Box className={accountNavClasses.profileCard}>
        <Box className={accountNavClasses.avatar}>
          {initials ? (
            <span
              className={`${accountNavClasses.avatarTxt} ${fontClassName.className}`}
            >
              {initials}
            </span>
          ) : (
            <UserIcon className={accountNavClasses.avatarIcon} />
          )}
        </Box>
        <Box className={accountNavClasses.identity}>
          <Typography
            className={`${accountNavClasses.name} ${fontClassName.className}`}
          >
            {displayName}
          </Typography>
          {contact && (
            <Typography
              className={`${accountNavClasses.contact} ${fontClassName.className}`}
            >
              {contact}
            </Typography>
          )}
        </Box>
      </Box>

      <Box className={accountNavClasses.navCard}>
        {rows.map((row) => {
          const rowActive = row.key === active;
          return (
            <ButtonBase
              key={row.key}
              disableRipple
              onClick={row.onClick}
              className={`${accountNavClasses.row} ${
                rowActive
                  ? accountNavClasses.rowActive
                  : accountNavClasses.rowIdle
              } ${fontClassName.className}`}
            >
              {row.icon}
              <span className={accountNavClasses.label}>{row.label}</span>
            </ButtonBase>
          );
        })}

        <Box className={accountNavClasses.divider} />

        {user ? (
          <ButtonBase
            disableRipple
            onClick={() => setSignOutOpen(true)}
            className={`${accountNavClasses.row} ${accountNavClasses.rowDanger} ${fontClassName.className}`}
          >
            <LogOut
              className={`${accountNavClasses.icon} ${accountNavClasses.iconDanger}`}
            />
            <span className={accountNavClasses.label}>{t('signout')}</span>
          </ButtonBase>
        ) : (
          <ButtonBase
            disableRipple
            onClick={() => router.push('/user/signin')}
            className={`${accountNavClasses.row} ${accountNavClasses.rowIdle} ${fontClassName.className}`}
          >
            <LogIn className={iconCls(false)} />
            <span className={accountNavClasses.label}>{t('signin')}</span>
          </ButtonBase>
        )}
      </Box>

      {/* Same confirm dialog the mobile profile page uses. */}
      <Dialog
        open={signOutOpen}
        onClose={() => setSignOutOpen(false)}
        PaperProps={{ className: profileClasses.dialog.main.web }}
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
              onClick={() => setSignOutOpen(false)}
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
    </Box>
  );
}
