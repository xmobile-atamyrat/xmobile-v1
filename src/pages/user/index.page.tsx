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
import { colors, interClassname } from '@/styles/theme';
import { ArrowForwardIos } from '@mui/icons-material';
import AccountTreeIcon from '@mui/icons-material/AccountTree';
import AnalyticsIcon from '@mui/icons-material/Analytics';
import DescriptionIcon from '@mui/icons-material/Description';
import DriveFolderUploadIcon from '@mui/icons-material/DriveFolderUpload';
import LocalShippingOutlinedIcon from '@mui/icons-material/LocalShippingOutlined';
import LoginOutlinedIcon from '@mui/icons-material/LoginOutlined';
import DeleteForeverOutlinedIcon from '@mui/icons-material/DeleteForeverOutlined';
import MeetingRoomOutlinedIcon from '@mui/icons-material/MeetingRoomOutlined';
import PolicyOutlinedIcon from '@mui/icons-material/PolicyOutlined';
import SupportAgentOutlinedIcon from '@mui/icons-material/SupportAgentOutlined';
import SystemUpdateAltIcon from '@mui/icons-material/SystemUpdateAlt';
import {
  Box,
  Button,
  CardMedia,
  Dialog,
  Divider,
  List,
  ListItemButton,
  Typography,
} from '@mui/material';
import { GetStaticProps } from 'next';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
// getStaticProps because translations are static
export const getStaticProps = (async (context) => {
  return {
    props: {
      messages: (await import(`../../i18n/${context.locale}.json`)).default,
    },
  };
}) satisfies GetStaticProps<object>;

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

  const handleToggleLang = () => {
    setOpenLang(!openLang);
  };

  const handleToggle = () => {
    setOpen(!open);
  };

  const handleToggleMyOrders = () => {
    const route = isAdmin ? '/orders/admin' : '/orders';
    router.push(route);
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

  return (
    <Layout handleHeaderBackButton={() => router.push('/')}>
      <Box className={profileClasses.boxes.loggedInMain}>
        <Box className={profileClasses.accountTitle[platform]}>
          <Typography
            className={`${profileClasses.typos.account[platform]} ${interClassname.className}`}
          >
            {t('account')}
          </Typography>
        </Box>
        <Box className={profileClasses.boxes.sectionBox[platform]}>
          <Box className={profileClasses.boxes.accountMain[platform]}>
            <CardMedia
              component="img"
              src="/profile/defaultProfile.jpg"
              className={profileClasses.profileImg[platform]}
            />
            <Box className={profileClasses.boxes.account}>
              <Typography
                className={`${interClassname.className} ${profileClasses.typos.name[platform]}`}
              >
                {`${t('hello')} ${
                  user && user.name.trim() !== ''
                    ? user.name.trim().split(' ')[0]
                    : t('guest')
                }`}
              </Typography>
              <Typography
                className={`${interClassname.className} ${profileClasses.typos.email}`}
              >
                {user?.email}
              </Typography>
            </Box>
          </Box>
          <Box className={profileClasses.boxes.divider[platform]}></Box>
          <Box className="w-[90%] flex flex-col items-center mx-auto">
            {!user && (
              <>
                <Button
                  className={profileClasses.boxes.sectionOrders[platform]}
                  disableRipple
                  onClick={() => router.push('/user/sign_in_up')}
                  variant={platform === 'web' ? 'outlined' : 'text'}
                  sx={{
                    '&:hover': { backgroundColor: colors.lightRed },
                  }}
                >
                  <LoginOutlinedIcon
                    className={`${profileClasses.sectionIcon[platform]} !text-[#000]`}
                  />
                  <Typography
                    className={`${interClassname.className} ${profileClasses.typos.sectionTxt[platform]}`}
                  >
                    {t('signin')}
                  </Typography>
                  <ArrowForwardIos className={profileClasses.icons[platform]} />
                </Button>
                <Divider className={profileClasses.divider[platform]} />
              </>
            )}
            <Button
              className={profileClasses.boxes.sectionLang[platform]}
              disableRipple
              onClick={handleToggleLang}
              variant={platform === 'web' ? 'outlined' : 'text'}
              sx={{
                '&:hover': { backgroundColor: colors.lightRed },
              }}
            >
              <CardMedia
                component="img"
                src="/profile/language.png"
                className={profileClasses.sectionIcon[platform]}
              />

              <Typography
                className={`${interClassname.className} ${profileClasses.typos.sectionTxt[platform]}`}
              >
                {t('appLanguage')}
              </Typography>
              <ArrowForwardIos className={profileClasses.icons[platform]} />
            </Button>
            <Divider className={profileClasses.divider[platform]} />
            {isAdmin && (
              <Box className="w-full">
                <Button
                  className={profileClasses.boxes.sectionOrders[platform]}
                  disableRipple
                  onClick={() => router.push('/product/update-prices')}
                  variant={platform === 'web' ? 'outlined' : 'text'}
                  sx={{
                    '&:hover': { backgroundColor: colors.lightRed },
                  }}
                >
                  <DriveFolderUploadIcon
                    className={`${profileClasses.sectionIcon[platform]} !text-[#000]`}
                  />
                  <Typography
                    className={`${interClassname.className} ${profileClasses.typos.sectionTxt[platform]}`}
                  >
                    {t('updatePrices')}
                  </Typography>
                  <ArrowForwardIos className={profileClasses.icons[platform]} />
                </Button>
                <Divider className={profileClasses.divider[platform]} />
                <Button
                  className={profileClasses.boxes.sectionOrders[platform]}
                  disableRipple
                  onClick={() => router.push('/product/update-colors')}
                  variant={platform === 'web' ? 'outlined' : 'text'}
                  sx={{
                    '&:hover': { backgroundColor: colors.lightRed },
                  }}
                >
                  <DriveFolderUploadIcon
                    className={`${profileClasses.sectionIcon[platform]} !text-[#000]`}
                  />
                  <Typography
                    className={`${interClassname.className} ${profileClasses.typos.sectionTxt[platform]}`}
                  >
                    {t('updateColors')}
                  </Typography>
                  <ArrowForwardIos className={profileClasses.icons[platform]} />
                </Button>
                <Divider className={profileClasses.divider[platform]} />
                <Button
                  className={profileClasses.boxes.sectionOrders[platform]}
                  disableRipple
                  onClick={() => router.push('/user/category-hierarchy')}
                  variant={platform === 'web' ? 'outlined' : 'text'}
                  sx={{
                    '&:hover': { backgroundColor: colors.lightRed },
                  }}
                >
                  <AccountTreeIcon
                    className={`${profileClasses.sectionIcon[platform]} !text-[#000]`}
                  />
                  <Typography
                    className={`${interClassname.className} ${profileClasses.typos.sectionTxt[platform]}`}
                  >
                    {t('categoryHierarchy')}
                  </Typography>
                  <ArrowForwardIos className={profileClasses.icons[platform]} />
                </Button>
                <Divider className={profileClasses.divider[platform]} />
                <Button
                  className={profileClasses.boxes.sectionOrders[platform]}
                  disableRipple
                  onClick={() => router.push('/analytics')}
                  variant={platform === 'web' ? 'outlined' : 'text'}
                  sx={{
                    '&:hover': { backgroundColor: colors.lightRed },
                  }}
                >
                  <AnalyticsIcon
                    className={`${profileClasses.sectionIcon[platform]} !text-[#000]`}
                  />
                  <Typography
                    className={`${interClassname.className} ${profileClasses.typos.sectionTxt[platform]}`}
                  >
                    {t('analytics')}
                  </Typography>
                  <ArrowForwardIos className={profileClasses.icons[platform]} />
                </Button>
                <Divider className={profileClasses.divider[platform]} />
                <Button
                  className={profileClasses.boxes.sectionOrders[platform]}
                  disableRipple
                  onClick={() => router.push('/server-logs')}
                  variant={platform === 'web' ? 'outlined' : 'text'}
                  sx={{
                    '&:hover': { backgroundColor: colors.lightRed },
                  }}
                >
                  <DescriptionIcon
                    className={`${profileClasses.sectionIcon[platform]} !text-[#000]`}
                  />
                  <Typography
                    className={`${interClassname.className} ${profileClasses.typos.sectionTxt[platform]}`}
                  >
                    {t('serverLogs')}
                  </Typography>
                  <ArrowForwardIos className={profileClasses.icons[platform]} />
                </Button>
                <Divider className={profileClasses.divider[platform]} />
                {user?.grade === 'SUPERUSER' && (
                  <Box>
                    <Button
                      className={profileClasses.boxes.sectionOrders[platform]}
                      disableRipple
                      onClick={() => router.push('/procurement')}
                      variant={platform === 'web' ? 'outlined' : 'text'}
                      sx={{
                        '&:hover': { backgroundColor: colors.lightRed },
                      }}
                    >
                      <LocalShippingOutlinedIcon
                        className={`${profileClasses.sectionIcon[platform]} !text-[#000]`}
                      />
                      <Typography
                        className={`${interClassname.className} ${profileClasses.typos.sectionTxt[platform]}`}
                      >
                        {t('procurement')}
                      </Typography>
                      <ArrowForwardIos
                        className={profileClasses.icons[platform]}
                      />
                    </Button>
                    <Divider className={profileClasses.divider[platform]} />
                    <Button
                      className={profileClasses.boxes.sectionOrders[platform]}
                      disableRipple
                      onClick={() => router.push('/admin/app-version')}
                      variant={platform === 'web' ? 'outlined' : 'text'}
                      sx={{
                        '&:hover': { backgroundColor: colors.lightRed },
                      }}
                    >
                      <SystemUpdateAltIcon
                        className={`${profileClasses.sectionIcon[platform]} !text-[#000]`}
                      />
                      <Typography
                        className={`${interClassname.className} ${profileClasses.typos.sectionTxt[platform]}`}
                      >
                        {t('appVersions')}
                      </Typography>
                      <ArrowForwardIos
                        className={profileClasses.icons[platform]}
                      />
                    </Button>
                    <Divider className={profileClasses.divider[platform]} />
                  </Box>
                )}
              </Box>
            )}
            <>
              <Button
                className={profileClasses.boxes.sectionOrders[platform]}
                disableRipple
                onClick={handleToggleMyOrders}
                variant={platform === 'web' ? 'outlined' : 'text'}
                sx={{
                  '&:hover': { backgroundColor: colors.lightRed },
                }}
              >
                <CardMedia
                  component="img"
                  src="/orders/my_order_icon.svg"
                  className={profileClasses.sectionIcon[platform]}
                />
                <Typography
                  className={`${interClassname.className} ${profileClasses.typos.sectionTxt[platform]}`}
                >
                  {isAdmin ? t('userOrders') : t('myOrders')}
                </Typography>
                <ArrowForwardIos className={profileClasses.icons[platform]} />
              </Button>
              <Divider className={profileClasses.divider[platform]} />
            </>
            <Button
              className={profileClasses.boxes.sectionOrders[platform]}
              disableRipple
              onClick={() => router.push('/support')}
              variant={platform === 'web' ? 'outlined' : 'text'}
              sx={{
                '&:hover': { backgroundColor: colors.lightRed },
              }}
            >
              <SupportAgentOutlinedIcon
                className={`${profileClasses.sectionIcon[platform]} !text-[#000]`}
              />
              <Typography
                className={`${interClassname.className} ${profileClasses.typos.sectionTxt[platform]}`}
              >
                {t('supportTitle')}
              </Typography>
              <ArrowForwardIos className={profileClasses.icons[platform]} />
            </Button>
            <Divider className={profileClasses.divider[platform]} />
            <Button
              className={profileClasses.boxes.sectionOrders[platform]}
              disableRipple
              onClick={() => router.push('/privacy-policy')}
              variant={platform === 'web' ? 'outlined' : 'text'}
              sx={{
                '&:hover': { backgroundColor: colors.lightRed },
              }}
            >
              <PolicyOutlinedIcon
                className={`${profileClasses.sectionIcon[platform]} !text-[#000]`}
              />
              <Typography
                className={`${interClassname.className} ${profileClasses.typos.sectionTxt[platform]}`}
              >
                {t('privacyPolicyTitle')}
              </Typography>
              <ArrowForwardIos className={profileClasses.icons[platform]} />
            </Button>
            <Divider className={profileClasses.divider[platform]} />
            {user && (
              <>
                <Button
                  className={profileClasses.boxes.sectionLogOut[platform]}
                  onClick={() => {
                    setDeleteAccountError(null);
                    setOpenDeleteAccount(true);
                  }}
                  variant={platform === 'web' ? 'outlined' : 'text'}
                  disableRipple
                  sx={{ '&:hover': { backgroundColor: colors.lightRed } }}
                >
                  <DeleteForeverOutlinedIcon
                    className={profileClasses.sectionIcon[platform]}
                    sx={{ color: '#ff3b30' }}
                  />
                  <Typography
                    className={`${interClassname.className} ${profileClasses.typos.sectionTxtLogOut[platform]}`}
                    sx={{ color: '#ff3b30' }}
                  >
                    {t('deleteAccount')}
                  </Typography>
                  <ArrowForwardIos
                    className={profileClasses.iconLogOut[platform]}
                    sx={{ color: '#ff3b30' }}
                  />
                </Button>
                <Divider className={profileClasses.divider[platform]} />
                <Button
                  className={profileClasses.boxes.sectionLogOut[platform]}
                  onClick={handleToggle}
                  variant={platform === 'web' ? 'outlined' : 'text'}
                  disableRipple
                >
                  <MeetingRoomOutlinedIcon
                    className={profileClasses.sectionIcon[platform]}
                  />
                  <Typography
                    className={`${interClassname.className} ${profileClasses.typos.sectionTxtLogOut[platform]}`}
                  >
                    {t('signout')}
                  </Typography>
                  <ArrowForwardIos
                    className={profileClasses.iconLogOut[platform]}
                  />
                </Button>
              </>
            )}
          </Box>
        </Box>
        <Dialog
          open={open}
          onClose={handleToggle}
          aria-labelledby="alert-dialog-title"
          aria-describedby="alert-dialog-description"
          PaperProps={{
            className: profileClasses.dialog.main[platform],
          }}
        >
          <Typography
            id="alert-dialog-title"
            className={`${profileClasses.typos.dialogSignOut} ${interClassname.className}`}
          >
            {t('signout').toLocaleUpperCase(router.locale)}
          </Typography>
          <Box className={profileClasses.boxes.verifyTxt}>
            <Typography
              className={`${profileClasses.typos.verifyTxt} ${interClassname.className}`}
            >
              {t('signOutVerify')}
            </Typography>
          </Box>
          <Box className={profileClasses.boxes.verify}>
            <Button onClick={handleToggle} disableRipple>
              <Box
                className={`${profileClasses.boxes.option} border-[1px] border-[#838383]`}
              >
                <Typography
                  className={`${interClassname.className} ${profileClasses.typos.option}`}
                  color={colors.black}
                >
                  {t('no')}
                </Typography>
              </Box>
            </Button>
            <Button
              disableRipple
              onClick={() => {
                (async () => {
                  try {
                    handleToggle();

                    if (accessToken) {
                      const fcmToken = localStorage.getItem(
                        FCM_TOKEN_STORAGE_KEY,
                      );
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
                })();
              }}
            >
              <Box className={`${profileClasses.boxes.option} bg-[#ff3b30]`}>
                <Typography
                  className={`${interClassname.className} ${profileClasses.typos.option}`}
                  color={colors.white}
                >
                  {t('yes')}
                </Typography>
              </Box>
            </Button>
          </Box>
        </Dialog>
        <Dialog
          open={openDeleteAccount}
          onClose={() => setOpenDeleteAccount(false)}
          aria-labelledby="delete-account-dialog-title"
          aria-describedby="delete-account-dialog-description"
          PaperProps={{
            className: `${profileClasses.dialog.main[platform]} !h-auto`,
          }}
        >
          <Typography
            id="delete-account-dialog-title"
            className={`${profileClasses.typos.dialogSignOut} ${interClassname.className}`}
            sx={{ color: '#ff3b30' }}
          >
            {t('deleteAccount').toUpperCase()}
          </Typography>
          <Box className="flex justify-center mt-[16px] px-[10px]">
            <Typography
              id="delete-account-dialog-description"
              className={`${profileClasses.typos.verifyTxt} ${interClassname.className} !h-auto text-center`}
            >
              {t('deleteAccountVerify')}
            </Typography>
          </Box>
          {deleteAccountError && (
            <Box className="flex justify-center mt-[8px]">
              <Typography
                className={`${interClassname.className} text-center text-[13px]`}
                sx={{ color: '#ff3b30' }}
              >
                {t(deleteAccountError)}
              </Typography>
            </Box>
          )}
          <Box className={profileClasses.boxes.verify}>
            <Button onClick={() => setOpenDeleteAccount(false)} disableRipple>
              <Box
                className={`${profileClasses.boxes.option} border-[1px] border-[#838383]`}
              >
                <Typography
                  className={`${interClassname.className} ${profileClasses.typos.option}`}
                  color={colors.black}
                >
                  {t('no')}
                </Typography>
              </Box>
            </Button>
            <Button
              disableRipple
              onClick={() => {
                (async () => {
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
                      const fcmToken = localStorage.getItem(
                        FCM_TOKEN_STORAGE_KEY,
                      );
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
                })();
              }}
            >
              <Box className={`${profileClasses.boxes.option} bg-[#ff3b30]`}>
                <Typography
                  className={`${interClassname.className} ${profileClasses.typos.option}`}
                  color={colors.white}
                >
                  {t('yes')}
                </Typography>
              </Box>
            </Button>
          </Box>
        </Dialog>
        <Dialog
          open={openLang}
          onClose={handleToggleLang}
          aria-labelledby="alert-dialog-title"
          aria-describedby="alert-dialog-description"
          PaperProps={{
            className: `${profileClasses.dialog.main[platform]} h-[300px]`,
          }}
        >
          <Typography
            id="alert-dialog-title"
            className={`${profileClasses.typos.language} ${interClassname.className}`}
          >
            {'Language'}
          </Typography>
          <List className={profileClasses.boxes.langList}>
            {lang.map((language) => (
              <ListItemButton
                className={profileClasses.boxes.langListitemButton}
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
                <Box className={profileClasses.boxes.langOption}>
                  <CardMedia
                    component="img"
                    src={language.img}
                    className={profileClasses.langImg}
                  />
                  <Typography
                    className={`${profileClasses.typos.langOption} ${interClassname.className}`}
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
