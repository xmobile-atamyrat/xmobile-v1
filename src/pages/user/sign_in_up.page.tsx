import Layout from '@/pages/components/Layout';
import { usePlatform } from '@/pages/lib/PlatformContext';
import { useUserContext } from '@/pages/lib/UserContext';
import { profileClasses } from '@/styles/classMaps/user/profile';
import { colors, interClassname } from '@/styles/theme';
import { Box, CardMedia, Link, Typography } from '@mui/material';
import { GetStaticProps } from 'next';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/router';
import { useEffect } from 'react';
// getStaticProps because translations are static
export const getStaticProps = (async () => {
  // For static export, we can't rely on context.locale (Next.js i18n)
  // Load default locale messages at build time
  // Client-side will switch locale based on cookie
  const defaultLocale = 'ru';
  let messages = {};
  try {
    messages = (await import(`../../i18n/${defaultLocale}.json`)).default;
  } catch (error) {
    console.error('Error loading messages:', error);
  }

  return {
    props: {
      messages,
      // Also load all locale messages so client can switch without page reload
      allMessages: {
        en: (await import('../../i18n/en.json')).default,
        ru: (await import('../../i18n/ru.json')).default,
        tk: (await import('../../i18n/tk.json')).default,
        ch: (await import('../../i18n/ch.json')).default,
        tr: (await import('../../i18n/tr.json')).default,
      },
    },
  };
}) satisfies GetStaticProps<object>;

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
