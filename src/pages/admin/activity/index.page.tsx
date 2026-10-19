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
  StaffPresence,
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
import { useCallback, useEffect, useRef, useState } from 'react';
import ActivityFeed, { ActivityFilters } from './ActivityFeed';
import ActivityHeatmap from './ActivityHeatmap';
import StaffCards from './StaffCards';

const STAFF_REFRESH_MS = 30_000;

type FeedPage = { items: ActivityRow[]; nextCursor: string | null };
type Heatmap = { from: string; to: string; days: HeatmapDay[] };
type LoadErrors = { staff: boolean; feed: boolean; heatmap: boolean };

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
  const [heatmapLoading, setHeatmapLoading] = useState(false);
  const [errors, setErrors] = useState<LoadErrors>({
    staff: false,
    feed: false,
    heatmap: false,
  });

  const isAuthorized = user != null && user.grade === UserRole.SUPERUSER;

  // Loaders read the token through a ref. fetchWithCreds stores a silently
  // refreshed token, and depending on the value itself would re-run the feed
  // load from page one, throwing away every page fetched with "show more".
  const accessTokenRef = useRef(accessToken);
  accessTokenRef.current = accessToken;
  const hasToken = Boolean(accessToken);

  const setError = useCallback((key: keyof LoadErrors, value: boolean) => {
    setErrors((previous) =>
      previous[key] === value ? previous : { ...previous, [key]: value },
    );
  }, []);

  useEffect(() => {
    if (!isUserLoading && !isAuthorized) router.push('/');
  }, [isUserLoading, isAuthorized, router]);

  const loadStaff = useCallback(async () => {
    const token = accessTokenRef.current;
    if (!token) return;
    try {
      const response = await fetchWithCreds<StaffMember[]>({
        accessToken: token,
        path: '/api/admin/activity/staff',
        method: 'GET',
      });
      if (response.success && response.data) {
        setStaff(response.data);
        setError('staff', false);
      } else {
        setError('staff', true);
      }
    } catch {
      setError('staff', true);
    }
  }, [fetchWithCreds, setError]);

  const refreshPresence = useCallback(async () => {
    const token = accessTokenRef.current;
    if (!token) return;
    try {
      const response = await fetchWithCreds<StaffPresence[]>({
        accessToken: token,
        path: '/api/admin/activity/staff?presence=1',
        method: 'GET',
      });
      if (!response.success || !response.data) return;
      const byId = new Map(response.data.map((entry) => [entry.id, entry]));
      setStaff((previous) =>
        previous.map((member) => {
          const entry = byId.get(member.id);
          return entry
            ? { ...member, lastSeenAt: entry.lastSeenAt, online: entry.online }
            : member;
        }),
      );
    } catch {
      // Presence is a nicety; the next tick tries again.
    }
  }, [fetchWithCreds]);

  // The totals on the cards are whole-history aggregates, so they load once and
  // again when the tab comes back. Only presence is polled, and not while the
  // tab is hidden.
  useEffect(() => {
    if (!isAuthorized || !hasToken) return undefined;
    loadStaff();
    const timer = setInterval(() => {
      if (!document.hidden) refreshPresence();
    }, STAFF_REFRESH_MS);
    const onVisible = () => {
      if (!document.hidden) loadStaff();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [isAuthorized, hasToken, loadStaff, refreshPresence]);

  const feedRequestId = useRef(0);

  const loadFeed = useCallback(
    async (cursor?: string) => {
      const token = accessTokenRef.current;
      if (!token) return;
      feedRequestId.current += 1;
      const requestId = feedRequestId.current;
      setFeedLoading(true);
      try {
        const response = await fetchWithCreds<FeedPage>({
          accessToken: token,
          path: `/api/admin/activity/feed${toQuery(filters, cursor)}`,
          method: 'GET',
        });
        if (requestId !== feedRequestId.current) return;
        if (response.success && response.data) {
          const page = response.data;
          setFeed((previous) => ({
            items: cursor ? [...previous.items, ...page.items] : page.items,
            nextCursor: page.nextCursor,
          }));
          setError('feed', false);
        } else {
          setError('feed', true);
        }
      } catch {
        if (requestId === feedRequestId.current) setError('feed', true);
      } finally {
        if (requestId === feedRequestId.current) setFeedLoading(false);
      }
    },
    [fetchWithCreds, filters, setError],
  );

  useEffect(() => {
    if (isAuthorized && hasToken) loadFeed();
  }, [isAuthorized, hasToken, loadFeed]);

  useEffect(() => {
    setHeatmap(undefined);
    const token = accessTokenRef.current;
    if (!isAuthorized || !token || !filters.userId) {
      setHeatmapLoading(false);
      setError('heatmap', false);
      return undefined;
    }
    let cancelled = false;
    setHeatmapLoading(true);
    fetchWithCreds<Heatmap>({
      accessToken: token,
      path: `/api/admin/activity/heatmap?userId=${encodeURIComponent(filters.userId)}`,
      method: 'GET',
    })
      .then((response) => {
        if (cancelled) return;
        if (response.success && response.data) {
          setHeatmap(response.data);
          setError('heatmap', false);
        } else {
          setError('heatmap', true);
        }
      })
      .catch(() => {
        if (!cancelled) setError('heatmap', true);
      })
      .finally(() => {
        if (!cancelled) setHeatmapLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isAuthorized, hasToken, filters.userId, fetchWithCreds, setError]);

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

        {(errors.staff || errors.feed || errors.heatmap) && (
          <Alert severity="error">{t('activityLoadError')}</Alert>
        )}

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
        {filters.userId && heatmapLoading && (
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
