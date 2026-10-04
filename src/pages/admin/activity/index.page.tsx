import { verifyToken } from '@/pages/api/utils/authMiddleware';
import { REFRESH_SECRET } from '@/pages/api/utils/tokenUtils';
import Layout from '@/pages/components/Layout';
import {
  appBarHeight,
  AUTH_REFRESH_COOKIE_NAME,
  mobileAppBarHeight,
} from '@/pages/lib/constants';
import {
  ActivityRow,
  HeatmapDay,
  StaffMember,
} from '@/pages/lib/adminActivity';
import { useFetchWithCreds } from '@/pages/lib/fetch';
import { useUserContext } from '@/pages/lib/UserContext';
import { colors, fontClassName } from '@/styles/theme';
import ActivityIcon from '@mui/icons-material/Timeline';
import {
  Alert,
  Box,
  CircularProgress,
  Divider,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import { UserRole } from '@prisma/client';
import { GetServerSideProps } from 'next';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/router';
import { useCallback, useEffect, useState } from 'react';
import ActivityFeed, { ActivityFilters } from './ActivityFeed';
import ActivityHeatmap from './ActivityHeatmap';
import StaffCards from './StaffCards';

const STAFF_REFRESH_MS = 30_000;

type FeedPage = { items: ActivityRow[]; nextCursor: string | null };
type Heatmap = { from: string; to: string; days: HeatmapDay[] };

export const getServerSideProps: GetServerSideProps = async (ctx) => {
  const home = {
    redirect: { destination: `/${ctx.locale || 'ru'}/`, permanent: false },
  };
  const refreshToken = ctx.req.cookies[AUTH_REFRESH_COOKIE_NAME];
  if (!refreshToken) return home;

  try {
    const decoded = await verifyToken(refreshToken, REFRESH_SECRET);
    if (decoded.grade !== UserRole.SUPERUSER) return home;
  } catch {
    return home;
  }

  return {
    props: {
      messages: (await import(`../../../i18n/${ctx.locale}.json`)).default,
    },
  };
};

const toQuery = (filters: ActivityFilters, cursor?: string) => {
  const params = new URLSearchParams();
  Object.entries({ ...filters, cursor }).forEach(([key, value]) => {
    if (value) params.set(key, value);
  });
  const query = params.toString();
  return query ? `?${query}` : '';
};

export default function AdminActivityPage() {
  const router = useRouter();
  const theme = useTheme();
  const isMdUp = useMediaQuery(theme.breakpoints.up('md'));
  const t = useTranslations();
  const { user, accessToken, isLoading: isUserLoading } = useUserContext();
  const fetchWithCreds = useFetchWithCreds();

  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [filters, setFilters] = useState<ActivityFilters>({});
  const [feed, setFeed] = useState<FeedPage>({ items: [], nextCursor: null });
  const [feedLoading, setFeedLoading] = useState(true);
  const [heatmap, setHeatmap] = useState<Heatmap | undefined>();
  const [failed, setFailed] = useState(false);

  const isAuthorized = user != null && user.grade === UserRole.SUPERUSER;

  useEffect(() => {
    if (!isUserLoading && !isAuthorized) router.push('/');
  }, [isUserLoading, isAuthorized, router]);

  const loadStaff = useCallback(async () => {
    if (!accessToken) return;
    try {
      const response = await fetchWithCreds<StaffMember[]>({
        accessToken,
        path: '/api/admin/activity/staff',
        method: 'GET',
      });
      if (response.success && response.data) setStaff(response.data);
      else setFailed(true);
    } catch {
      setFailed(true);
    }
  }, [accessToken, fetchWithCreds]);

  useEffect(() => {
    if (!isAuthorized) return undefined;
    loadStaff();
    const timer = setInterval(loadStaff, STAFF_REFRESH_MS);
    return () => clearInterval(timer);
  }, [isAuthorized, loadStaff]);

  const loadFeed = useCallback(
    async (cursor?: string) => {
      if (!accessToken) return;
      setFeedLoading(true);
      try {
        const response = await fetchWithCreds<FeedPage>({
          accessToken,
          path: `/api/admin/activity/feed${toQuery(filters, cursor)}`,
          method: 'GET',
        });
        if (response.success && response.data) {
          const page = response.data;
          setFeed((previous) => ({
            items: cursor ? [...previous.items, ...page.items] : page.items,
            nextCursor: page.nextCursor,
          }));
          setFailed(false);
        } else {
          setFailed(true);
        }
      } catch {
        setFailed(true);
      } finally {
        setFeedLoading(false);
      }
    },
    [accessToken, fetchWithCreds, filters],
  );

  useEffect(() => {
    if (isAuthorized) loadFeed();
  }, [isAuthorized, loadFeed]);

  useEffect(() => {
    if (!isAuthorized || !accessToken || !filters.userId) {
      setHeatmap(undefined);
      return;
    }
    let cancelled = false;
    fetchWithCreds<Heatmap>({
      accessToken,
      path: `/api/admin/activity/heatmap?userId=${encodeURIComponent(filters.userId)}`,
      method: 'GET',
    })
      .then((response) => {
        if (!cancelled && response.success) setHeatmap(response.data);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    // eslint-disable-next-line consistent-return
    return () => {
      cancelled = true;
    };
  }, [isAuthorized, accessToken, filters.userId, fetchWithCreds]);

  if (isUserLoading || !isAuthorized) return null;

  const selected = staff.find((member) => member.id === filters.userId);
  const selectedDay =
    filters.from && filters.from === filters.to ? filters.from : undefined;

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
        className="flex flex-col gap-6 w-full"
      >
        <Box className="flex flex-row items-center gap-2">
          <ActivityIcon
            sx={{ fontSize: isMdUp ? 28 : 24, color: colors.main }}
          />
          <Typography
            fontWeight={700}
            fontSize={isMdUp ? 22 : 18}
            className={fontClassName.className}
          >
            {t('adminActivity')}
          </Typography>
        </Box>

        {failed && <Alert severity="error">{t('activityLoadError')}</Alert>}

        <Box className="flex flex-col gap-3">
          <Typography fontWeight={600} className={fontClassName.className}>
            {t('activityStaff')}
          </Typography>
          {staff.length === 0 ? (
            <Typography color="text.secondary">
              {t('activityNoStaff')}
            </Typography>
          ) : (
            <StaffCards
              staff={staff}
              selectedId={filters.userId}
              onSelect={(userId) =>
                setFilters({
                  ...filters,
                  userId,
                  from: undefined,
                  to: undefined,
                })
              }
            />
          )}
        </Box>

        {selected && heatmap && (
          <>
            <Divider />
            <ActivityHeatmap
              name={selected.name}
              from={heatmap.from}
              to={heatmap.to}
              days={heatmap.days}
              selectedDay={selectedDay}
              onSelectDay={(day) =>
                setFilters({ ...filters, from: day, to: day })
              }
            />
          </>
        )}
        {filters.userId && !heatmap && (
          <Box className="flex flex-row justify-center">
            <CircularProgress size={24} />
          </Box>
        )}

        <Divider />

        <Box className="flex flex-col gap-3">
          <Typography fontWeight={600} className={fontClassName.className}>
            {t('activityFeed')}
          </Typography>
          <ActivityFeed
            staff={staff}
            filters={filters}
            onFiltersChange={setFilters}
            items={feed.items}
            loading={feedLoading}
            hasMore={feed.nextCursor != null}
            onLoadMore={() => feed.nextCursor && loadFeed(feed.nextCursor)}
          />
        </Box>
      </Box>
    </Layout>
  );
}
