import Layout from '@/pages/components/Layout';
import { usePlatform } from '@/pages/lib/PlatformContext';
import { useUserContext } from '@/pages/lib/UserContext';
import { buttonClasses } from '@/styles/classMaps/components/button';
import { signInUpClasses } from '@/styles/classMaps/user/sign_in_up';
import { colors, fontClassName, muted, navy } from '@/styles/theme';
import { Box, Button, CardMedia, Typography } from '@mui/material';
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
      <Box className={signInUpClasses.page[platform]}>
        <CardMedia
          component="img"
          src="/logo/xmobile-processed-logo.png"
          className={signInUpClasses.logo}
        />
        <Typography
          className={`${signInUpClasses.title[platform]} ${fontClassName.className}`}
          style={{ color: colors.blackText }}
        >
          {t('welcomeToXmobile')}
        </Typography>
        <Typography
          className={`${signInUpClasses.subtitle} ${fontClassName.className}`}
          style={{ color: muted }}
        >
          {t('signInUpSubtitle')}
        </Typography>
        <Box className={signInUpClasses.options}>
          <Link
            href="/user/signin"
            className={`${buttonClasses.primary[platform]} ${signInUpClasses.optionButton} ${fontClassName.className}`}
          >
            {t('signin')}
          </Link>
          <Link
            href="/user/signup"
            className={`${buttonClasses.outlined[platform]} ${signInUpClasses.optionButton} ${fontClassName.className}`}
          >
            {t('signup')}
          </Link>
        </Box>
        <Button
          className={`${signInUpClasses.guestLink} ${fontClassName.className}`}
          style={{ color: navy }}
          onClick={() => router.push('/')}
        >
          {t('continueAsGuest')}
        </Button>
      </Box>
    </Layout>
  );
}
