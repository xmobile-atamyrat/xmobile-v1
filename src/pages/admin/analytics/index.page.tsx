import { currentGrade, verifyToken } from '@/pages/api/utils/authMiddleware';
import { isStaff } from '@/pages/api/utils/staffAuth';
import { REFRESH_SECRET } from '@/pages/api/utils/tokenUtils';
import Layout from '@/pages/components/Layout';
import {
  appBarHeight,
  AUTH_REFRESH_COOKIE_NAME,
  mobileAppBarHeight,
} from '@/pages/lib/constants';
import { useUserContext } from '@/pages/lib/UserContext';
import { colors, fontClassName } from '@/styles/theme';
import AnalyticsIcon from '@mui/icons-material/Insights';
import { Box, Typography, useMediaQuery, useTheme } from '@mui/material';
import { GetServerSideProps } from 'next';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/router';
import { useEffect } from 'react';

import AnalyticsDashboard from './AnalyticsDashboard';

// No seoData: _app marks the page noindex.
export const getServerSideProps: GetServerSideProps = async (ctx) => {
  const home = {
    redirect: { destination: `/${ctx.locale || 'ru'}/`, permanent: false },
  };
  const refreshToken = ctx.req.cookies[AUTH_REFRESH_COOKIE_NAME];
  if (!refreshToken) return home;
  try {
    const { userId } = await verifyToken(refreshToken, REFRESH_SECRET);
    // Go by the account's current grade, not the one baked into the cookie.
    if (!isStaff((await currentGrade(userId)) ?? undefined)) return home;
  } catch {
    return home;
  }

  return {
    props: {
      messages: (await import(`../../../i18n/${ctx.locale}.json`)).default,
    },
  };
};

export default function AdminAnalyticsPage() {
  const router = useRouter();
  const theme = useTheme();
  const isMdUp = useMediaQuery(theme.breakpoints.up('md'));
  const t = useTranslations();
  const { user, isLoading: isUserLoading } = useUserContext();
  // Compared inline: staffAuth's isStaff imports server-only modules (Prisma,
  // Slack), which can't go into the client bundle.
  const isAuthorized = user?.grade === 'ADMIN' || user?.grade === 'SUPERUSER';

  useEffect(() => {
    if (!isUserLoading && !isAuthorized) router.push('/');
  }, [isUserLoading, isAuthorized, router]);

  if (isUserLoading || !isAuthorized) return null;

  return (
    <Layout handleHeaderBackButton={() => router.push('/user')}>
      <Box
        sx={{
          mt: isMdUp
            ? `${appBarHeight * 1.25}px`
            : `${mobileAppBarHeight * 1.25}px`,
          px: isMdUp ? 4 : 2,
          pb: 6,
        }}
        className="flex flex-col gap-4 w-full"
      >
        <Box className="flex flex-row items-center gap-2">
          <AnalyticsIcon
            sx={{ fontSize: isMdUp ? 28 : 24, color: colors.main }}
          />
          <Typography
            component="h1"
            fontWeight={700}
            fontSize={isMdUp ? 22 : 18}
            className={fontClassName.className}
          >
            {t('analytics')}
          </Typography>
        </Box>
        <AnalyticsDashboard />
      </Box>
    </Layout>
  );
}
