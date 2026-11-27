import Layout from '@/pages/components/Layout';
import { appBarHeight, mobileAppBarHeight } from '@/pages/lib/constants';
import { useUserContext } from '@/pages/lib/UserContext';
import { colors, fontClassName } from '@/styles/theme';
import AnalyticsIcon from '@mui/icons-material/Insights';
import { Box, Typography, useMediaQuery, useTheme } from '@mui/material';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/router';
import { useEffect } from 'react';

import AnalyticsDashboard from './AnalyticsDashboard';
import { adminAnalyticsServerProps } from './serverProps';

export const getServerSideProps = adminAnalyticsServerProps;

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
    <Layout
      mobileBackButton
      handleHeaderBackButton={() => router.push('/user')}
    >
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
