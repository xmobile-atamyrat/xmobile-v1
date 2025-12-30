import Layout from '@/pages/components/Layout';
import { usePlatform } from '@/pages/lib/PlatformContext';
import { useUserContext } from '@/pages/lib/UserContext';
import { profileClasses } from '@/styles/classMaps/user/profile';
import { colors, interClassname } from '@/styles/theme';
import { Box, CardMedia, Link, Typography } from '@mui/material';
import { GetStaticProps } from 'next';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/router';
// getStaticProps because translations are static
export const getStaticProps = (async (context) => {
  return {
    props: {
      messages: (await import(`../../i18n/${context.locale}.json`)).default,
    },
  };
}) satisfies GetStaticProps<object>;

export default function SignInUp() {
  const { user } = useUserContext();
  const router = useRouter();
  const t = useTranslations();
  const platform = usePlatform();
  if (user) router.push('/user');

  return (
    <Layout handleHeaderBackButton={() => router.back()}>
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
