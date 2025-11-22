import Footer from '@/pages/components/Footer';
import {
  AUTH_REFRESH_COOKIE_NAME,
  LOCALE_COOKIE_NAME,
} from '@/pages/lib/constants';
import { useUserContext } from '@/pages/lib/UserContext';
import { deleteCookie, getCookie, setCookie } from '@/pages/lib/utils';
import { interClassname } from '@/styles/theme';
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
        <Box className="w-[88.78vw] h-full mx-auto flex flex-col items-center justify-center">
          <CardMedia
            component="img"
            src="/xmobile-processed-logo.png"
            className="w-[230px] mb-[50px]"
          />
          <Box className="h-[116px] flex flex-col w-full justify-center items-center">
            <Link
              className="no-underline flex w-full justify-center items-center bg-[#221765] rounded-[12px] gap-[8px] py-[4px] px-[20px] h-[48px]"
              href="/user/signin"
            >
              <Typography
                className={`font-medium text-[16px] leading-[24px] tracking-normal text-[#fff] ${interClassname.className}`}
              >
                {t('signin')}
              </Typography>
            </Link>
            <Link
              className="no-underline flex w-full justify-center items-center bg-[#fff] rounded-[12px] gap-[8px] py-[4px] px-[20px] h-[48px] border-[1px] border-[#221765] mt-[20px]"
              href="/user/signup"
            >
              <Typography
                className={`font-medium text-[16px] leading-[24px] tracking-normal text-[#221765] ${interClassname.className}`}
              >
                {t('signup')}
              </Typography>
            </Link>
          </Box>
        </Box>
      ) : (
        <Box className="w-full h-full flex flex-col items-center">
          <Typography
            className={`mt-[8px] font-medium text-[20px] leading-none tracking-normal text-[#000] ${interClassname.className}`}
          >
            {t('account')}
          </Typography>

          <Box className="w-full h-[90px] py-[16px] px-[28px] gap-[16px] flex justify-center items-center mt-[25px]">
            <Box className="gap-[16px] w-[86.91%] h-[60px] flex flex-col justify-center">
              <Typography
                className={`${interClassname.className} font-medium text-[16px] leading-none tracking-normal text-[#1b1b1b]`}
              >
                {user.name}
              </Typography>
              <Typography
                className={`${interClassname.className} font-regular text-[14px] leading-none tracking-normal text-[#838383]`}
              >
                {user.email}
              </Typography>
            </Box>
          </Box>
          <Box className="w-full h-[4px] bg-[#f6f6f6]"></Box>
          <Box className="w-full px-[30px] mt-[20px]">
            <Box className="flex flex-row w-full h-[30px] items-center">
              <CardMedia
                component="img"
                src="/language.png"
                className="w-[20px] h-[20px]"
              />
              <Button
                className="flex flex-row ml-[20px] w-full h-full items-center justify-between no-underline p-0 normal-case"
                onClick={handleToggleLang}
              >
                <Typography
                  className={`${interClassname.className} font-medium text-[13px] leading-[18px] tracking-normal text-[#000]`}
                >
                  {t('appLanguage')}
                </Typography>
                <ArrowForwardIosIcon className="w-[17px] h-[17px] text-[#000]" />
              </Button>
            </Box>
          </Box>
          <Divider className="h-[1px] text-[#e7e7e7] w-[80%] my-[20px]" />
          <Box className="w-full px-[30px]">
            <Box className="flex flex-row w-full h-[30px] items-center">
              <CardMedia
                component="img"
                src="/logout.png"
                className="w-[20px] h-[20px]"
              />
              <Button
                className="flex flex-row ml-[20px] w-full h-full items-center justify-between no-underline p-0 normal-case"
                onClick={handleToggle}
              >
                <Typography
                  className={`${interClassname.className} font-medium text-[13px] leading-[18px] tracking-normal text-[#000]`}
                >
                  {t('signout')}
                </Typography>
                <ArrowForwardIosIcon className="w-[17px] h-[17px] text-[#000]" />
              </Button>
            </Box>
          </Box>
          <Dialog
            open={open}
            onClose={handleToggle}
            aria-labelledby="alert-dialog-title"
            aria-describedby="alert-dialog-description"
            PaperProps={{
              className:
                'w-[90vw] h-[220px] rounded-[10px] bg-[#fff] flex mx-auto my-auto justify-center py-[30px] px-[20px]',
            }}
          >
            <Typography
              id="alert-dialog-title"
              className={`flex justify-center font-semibold text-[22px] leading-[28px] tracking-normal text-[#000] ${interClassname.className}`}
            >
              {t('signout').toUpperCase()}
            </Typography>
            <Box className="flex h-[20px] justify-center mt-[20px]">
              <Typography
                className={`flex justify-center font-medium text-[15px] leading-[20px] tracking-normal text-[#353636] h-[20px]`}
              >
                {t('signOutVerify')}
              </Typography>
            </Box>
            <Box className="w-[90%] flex flex-row justify-between mt-[30px] mx-auto">
              <Button onClick={handleToggle}>
                <Box className="flex justify-center items-center w-[160px] h-[50px] rounded-[12px] border-[1px] border-[#838383]">
                  <Typography
                    className={`${interClassname.className} font-regular text-[17px] leading-[22px] tracking-normal text-[#000] normal-case`}
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
                <Box className="flex justify-center items-center w-[160px] h-[50px] rounded-[12px] bg-[#ff3b30]">
                  <Typography
                    className={`${interClassname.className} font-regular text-[17px] leading-[22px] tracking-normal text-[#fff] normal-case`}
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
              className:
                'w-[90vw] h-[329px] rounded-[10px] bg-[#fff] flex mx-auto my-auto justify-center py-[30px] px-[20px]',
            }}
          >
            <Typography
              id="alert-dialog-title"
              className={`flex justify-center font-semibold text-[22px] leading-[28px] tracking-normal text-[#000] ${interClassname.className}`}
            >
              {'Language'.toUpperCase()}
            </Typography>
            <List className="min-w-[110px] h-[238px] border-0 flex flex-col mt-[20px]">
              {lang.map((language) => (
                <ListItemButton
                  className="px-[12px] gap-[10px]"
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
                      backgroundColor: '#f4f4f4',
                    },
                  }}
                >
                  <Box className="flex flex-row justify-start w-full items-center px-[12px] gap-[10px]">
                    <CardMedia
                      component="img"
                      src={language.img}
                      className="w-[24px] h-[18px]"
                    />
                    <Typography
                      className={`text-[#303030] text-[14px] text-regular leading-[20px] tracking-normal ${interClassname.className}`}
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
