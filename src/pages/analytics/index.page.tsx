import Layout from '@/pages/components/Layout';
import { appBarHeight, mobileAppBarHeight } from '@/pages/lib/constants';
import { ResponseApi } from '@/pages/lib/types';
import { useUserContext } from '@/pages/lib/UserContext';
import {
  Box,
  CircularProgress,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import { GetStaticProps } from 'next';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';

interface AnalyticsStats {
  userCount: number;
  dailyVisitCount: number;
  lastWeekVisitCount: number;
  lastMonthVisitCount: number;
  balance: number | null;
  errorMessage: string | null;
}

export const getStaticProps: GetStaticProps = async (context) => {
  let messages = {};
  try {
    messages = (await import(`../../i18n/${context.locale}.json`)).default;
  } catch (error) {
    console.error('Error loading messages:', error);
  }

  return {
    props: {
      messages,
    },
  };
};

export default function Analytics() {
  const router = useRouter();
  const { user } = useUserContext();
  const theme = useTheme();
  const isMdUp = useMediaQuery(theme.breakpoints.up('md'));
  const t = useTranslations();

  const [stats, setStats] = useState<AnalyticsStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const response = await fetch('/api/analytics/stats');
        const result: ResponseApi<AnalyticsStats> = await response.json();

        if (result.success && result.data) {
          setStats(result.data);
        } else {
          setError(result.message || 'Failed to fetch analytics');
        }
      } catch (err) {
        console.error('Error fetching analytics:', err);
        setError((err as Error).message || 'Failed to fetch analytics');
      } finally {
        setIsLoading(false);
      }
    };

    if (['SUPERUSER', 'ADMIN'].includes(user?.grade || '')) {
      fetchStats();
    } else {
      setIsLoading(false);
    }
  }, [user?.grade]);

  return (
    <Layout handleHeaderBackButton={() => router.push('/')}>
      {['SUPERUSER', 'ADMIN'].includes(user?.grade || '') && (
        <Box
          sx={{
            mt: isMdUp
              ? `${appBarHeight * 1.25}px`
              : `${mobileAppBarHeight * 1.25}px`,
            px: isMdUp ? 4 : 1,
          }}
          className="flex flex-col gap-8 w-full h-full"
        >
          <Typography fontWeight={600} fontSize={20}>
            {t('analytics')}
          </Typography>

          {isLoading && (
            <Box className="flex justify-center items-center py-8">
              <CircularProgress />
            </Box>
          )}

          {error && (
            <Box className="flex justify-center items-center py-8">
              <Typography color="error">{error}</Typography>
            </Box>
          )}

          {!isLoading && !error && stats && (
            <>
              {stats.balance != null && (
                <Box className="flex flex-row gap-4">
                  <Typography className="w-2/3">
                    {t('telekomBalance')}
                  </Typography>
                  <Typography fontWeight={600}>
                    {`${stats.balance} TMT`}
                  </Typography>
                </Box>
              )}
              <Box className="flex flex-row gap-4">
                <Typography className="w-2/3">{t('totalUserCount')}</Typography>
                <Typography fontWeight={600}>{stats.userCount}</Typography>
              </Box>
              <Box className="flex flex-row gap-4">
                <Typography className="w-2/3">
                  {t('dailyVisitCount')}
                </Typography>
                <Typography fontWeight={600}>
                  {stats.dailyVisitCount}
                </Typography>
              </Box>
              <Box className="flex flex-row gap-4">
                <Typography className="w-2/3">
                  {t('lastWeekVisitCount')}
                </Typography>
                <Typography fontWeight={600}>
                  {stats.lastWeekVisitCount}
                </Typography>
              </Box>
              <Box className="flex flex-row gap-4">
                <Typography className="w-2/3">
                  {t('lastMonthVisitCount')}
                </Typography>
                <Typography fontWeight={600}>
                  {stats.lastMonthVisitCount}
                </Typography>
              </Box>
            </>
          )}
        </Box>
      )}
    </Layout>
  );
}
