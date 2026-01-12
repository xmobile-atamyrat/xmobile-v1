import Layout from '@/pages/components/Layout';
import {
  AUTH_REFRESH_COOKIE_NAME,
  LOCALE_COOKIE_NAME,
} from '@/pages/lib/constants';
import {
  FCM_TOKEN_REGISTERED_KEY,
  FCM_TOKEN_STORAGE_KEY,
} from '@/pages/lib/fcm/useFCM';
import { usePlatform } from '@/pages/lib/PlatformContext';
import { useUserContext } from '@/pages/lib/UserContext';
import { deleteCookie, getCookie, setCookie } from '@/pages/lib/utils';
import { cartIndexClasses } from '@/styles/classMaps/cart';
import { profileClasses } from '@/styles/classMaps/user/profile';
import { colors, interClassname } from '@/styles/theme';
import { ArrowForwardIos } from '@mui/icons-material';
import AnalyticsIcon from '@mui/icons-material/Analytics';
import DescriptionIcon from '@mui/icons-material/Description';
import DriveFolderUploadIcon from '@mui/icons-material/DriveFolderUpload';
import LocalShippingOutlinedIcon from '@mui/icons-material/LocalShippingOutlined';
import MeetingRoomOutlinedIcon from '@mui/icons-material/MeetingRoomOutlined';
import {
  Box,
  Button,
  CardMedia,
  CircularProgress,
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
  const { user, setUser, setAccessToken, isLoading } = useUserContext();
  const [open, setOpen] = useState(false);
  const [openLang, setOpenLang] = useState(false);
  const [selectedLocale, setSelectedLocale] = useState('ru');
  const router = useRouter();
  const t = useTranslations();
  const platform = usePlatform();
  const lang = [
    { val: 'ru', name: 'Русский', img: '/Russia.png' },
    { val: 'tk', name: 'Türkmençe', img: '/Turkmenistan.png' },
    { val: 'tr', name: 'Türkce', img: '/Turkey.png' },
    { val: 'ch', name: 'Çärjowça', img: '/Turkmenistan.png' },
    { val: 'en', name: 'English', img: '/UnitedKingdom.png' },
  ];
  const isAdmin = user && ['SUPERUSER', 'ADMIN'].includes(user.grade);

  useEffect(() => {
    setSelectedLocale((prev) => getCookie(LOCALE_COOKIE_NAME) || prev);
  }, []);

  useEffect(() => {
    if (isLoading) {
      return;
    }
    if (!user) {
      router.push('/user/sign_in_up');
    }
  }, [user, isLoading, router]);

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
          <Box className="flex justify-center items-center h-full">
            <CircularProgress />
          </Box>
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
              src="/defaultProfile.jpg"
              className={profileClasses.profileImg[platform]}
            />
            <Box className={profileClasses.boxes.account}>
              <Typography
                className={`${interClassname.className} ${profileClasses.typos.name[platform]}`}
              >
                {`${t('hello')} ${
                  user?.name && user.name.trim() !== ''
                    ? user.name.trim().split(' ')[0]
                    : ''
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
                src="/language.png"
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
                  </Box>
                )}
              </Box>
            )}
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
            {t('signout').toUpperCase()}
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
                    deleteCookie(AUTH_REFRESH_COOKIE_NAME);
                    setUser(undefined);
                    setAccessToken(undefined);
                    localStorage.removeItem(FCM_TOKEN_STORAGE_KEY);
                    localStorage.removeItem(FCM_TOKEN_REGISTERED_KEY);
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
