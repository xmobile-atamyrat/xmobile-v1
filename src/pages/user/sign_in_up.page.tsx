import Layout from '@/pages/components/Layout';
import { usePlatform } from '@/pages/lib/PlatformContext';
import { useUserContext } from '@/pages/lib/UserContext';
import { profileClasses } from '@/styles/classMaps/user/profile';
import { colors, interClassname } from '@/styles/theme';
import { Box, CardMedia, Typography } from '@mui/material';
import Link from 'next/link';
import { LOCALE_COOKIE_NAME } from '@/pages/lib/constants';
import cookie from 'cookie';
import { GetServerSideProps } from 'next';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/router';
import { useEffect } from 'react';

export const getServerSideProps: GetServerSideProps = async (context) => {
  const cookieLocale = cookie.parse(context.req.headers.cookie ?? '')[
    LOCALE_COOKIE_NAME
  ];
  const locale =
    context.locale !== context.defaultLocale
      ? context.locale!
      : cookieLocale ?? context.locale ?? 'ru';
  const messages = (await import(`../../i18n/${locale}.json`)).default;
  return { props: { messages } };
};

export default function SignInUp() {
  const router = useRouter();
  const t = useTranslations();
  const platform = usePlatform();
  const { user, isLoading } = useUserContext();

  useEffect(() => {
    if (!isLoading && user) {
      router.push('/user');
    }
  }, [isLoading, user, router]);

  if (isLoading) {
    return null;
  }

  return (
    <Layout
      handleHeaderBackButton={() => {
        router.push('/');
      }}
    >
      <Box className={profileClasses.boxes.main[platform]}>
        <Box className={profileClasses.boxes.loggedOutMain[platform]}>
          <CardMedia
            component="img"
            src="/logo/xmobile-processed-logo.png"
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
              className={`${profileClasses.logInOptionsLink[platform]} bg-[#fff] border-[1px] border-[#ff624c] mb-[20px]`}
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
    </Layout>
  );
}
