import Footer from '@/pages/components/Footer';
import {
  AUTH_REFRESH_COOKIE_NAME,
  LOCALE_COOKIE_NAME,
} from '@/pages/lib/constants';
import { usePlatform } from '@/pages/lib/PlatformContext';
import { useUserContext } from '@/pages/lib/UserContext';
import { deleteCookie, getCookie, setCookie } from '@/pages/lib/utils';
import { profileClasses } from '@/styles/classMaps/user/profile';
import { signinClasses } from '@/styles/classMaps/user/signin';
import { colors, interClassname } from '@/styles/theme';
import { ArrowBackIos } from '@mui/icons-material';
import ArrowForwardIosIcon from '@mui/icons-material/ArrowForwardIos';
import {
  Box,
  Button,
  CardMedia,
  Dialog,
  Divider,
  Link,
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
  const { user, setUser, setAccessToken } = useUserContext();
  const [open, setOpen] = useState(false);
  const [openLang, setOpenLang] = useState(false);
  const [selectedLocale, setSelectedLocale] = useState('ru');
  const router = useRouter();
  const t = useTranslations();
  const lang = [
    { val: 'ru', name: 'Русский', img: '/Russia.png' },
    { val: 'tk', name: 'Türkmençe', img: '/Turkmenistan.png' },
    { val: 'tr', name: 'Türkce', img: '/Turkey.png' },
    { val: 'ch', name: 'Çärjowça', img: '/Turkmenistan.png' },
    { val: 'en', name: 'English', img: '/UnitedKingdom.png' },
  ];
  const platform = usePlatform();

  useEffect(() => {
    setSelectedLocale((prev) => getCookie(LOCALE_COOKIE_NAME) || prev);
  }, []);

  const handleToggleLang = () => {
    setOpenLang(!openLang);
  };

  const handleToggle = () => {
    setOpen(!open);
  };
  return (
    <Box className="w-full h-full">
      {!user ? (
        <Box className={profileClasses.boxes.main[platform]}>
          <Link href="/">
            <ArrowBackIos
              className={`${signinClasses.link[platform]}`}
              style={{ color: colors.text[platform] }}
            />
          </Link>
          <Box className={profileClasses.boxes.loggedOutMain[platform]}>
            <CardMedia
              component="img"
              src="/xmobile-processed-logo.png"
              className={profileClasses.logo}
            />
            <Box className={profileClasses.boxes.loggedOutOptions[platform]}>
              <Link
                className={`${profileClasses.logInOptionsLink[platform]} bg-[#ff624c]`}
                href="/user/signin"
              >
                <Typography
                  className={`${profileClasses.logInOptionsTypo[platform]} ${interClassname.className}`}
                  color={colors.white}
                >
                  {t('signin')}
                </Typography>
              </Link>
              <Link
                className={`${profileClasses.logInOptionsLink[platform]} bg-[#fff] border-[1px] border-[#ff624c]`}
                href="/user/signup"
              >
                <Typography
                  className={`${profileClasses.logInOptionsTypo[platform]} ${interClassname.className}`}
                  color={colors.main}
                >
                  {t('signup')}
                </Typography>
              </Link>
            </Box>
          </Box>
        </Box>
      ) : (
        <Box className={profileClasses.boxes.loggedInMain}>
          <Typography
            className={`${profileClasses.typos.account} ${interClassname.className}`}
          >
            {t('account')}
          </Typography>

          <Box className={profileClasses.boxes.accountMain}>
            <Box className={profileClasses.boxes.account}>
              <Typography
                className={`${interClassname.className} ${profileClasses.typos.name}`}
              >
                {user.name}
              </Typography>
              <Typography
                className={`${interClassname.className} ${profileClasses.typos.email}`}
              >
                {user.email}
              </Typography>
            </Box>
          </Box>
          <Box className={profileClasses.boxes.divider}></Box>
          <Box className={profileClasses.boxes.section}>
            <CardMedia
              component="img"
              src="/language.png"
              className={profileClasses.sectionIcon}
            />
            <Button className={profileClasses.btn} onClick={handleToggleLang}>
              <Typography
                className={`${interClassname.className} ${profileClasses.typos.sectionTxt}`}
              >
                {t('appLanguage')}
              </Typography>
              <ArrowForwardIosIcon className={profileClasses.icons} />
            </Button>
          </Box>
          <Divider className={profileClasses.divider} />
          <Box className={profileClasses.boxes.section}>
            <CardMedia
              component="img"
              src="/logout.png"
              className={profileClasses.sectionIcon}
            />
            <Button className={profileClasses.btn} onClick={handleToggle}>
              <Typography
                className={`${interClassname.className} ${profileClasses.typos.sectionTxt}`}
              >
                {t('signout')}
              </Typography>
              <ArrowForwardIosIcon className={profileClasses.icons} />
            </Button>
          </Box>
          <Dialog
            open={open}
            onClose={handleToggle}
            aria-labelledby="alert-dialog-title"
            aria-describedby="alert-dialog-description"
            PaperProps={{
              className: profileClasses.dialog.main,
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
              <Button onClick={handleToggle}>
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
                onClick={() => {
                  (async () => {
                    try {
                      handleToggle();
                      deleteCookie(AUTH_REFRESH_COOKIE_NAME);
                      setUser(undefined);
                      setAccessToken(undefined);
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
              className: `${profileClasses.dialog.main} h-[300px]`,
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
      )}
      <Footer />
    </Box>
  );
}
