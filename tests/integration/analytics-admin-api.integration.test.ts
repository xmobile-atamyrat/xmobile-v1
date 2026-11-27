import type {
  GetServerSidePropsContext,
  NextApiRequest,
  NextApiResponse,
} from 'next';
import { PrismaClient, type UserRole } from '@prisma/client';
import { createMocks, type RequestMethod } from 'node-mocks-http';
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import { WIDGETS } from '@/lib/analytics/metrics/catalog';
import type { AnalyticsResponse } from '@/lib/analytics/metrics/types';

import { resetPrismaGlobalSingleton } from './helpers/reset-prisma-global';
import { createStaffPrincipal } from './shared/staff-token';
import {
  prepareIntegrationWorker,
  teardownIntegrationWorker,
} from './shared/worker-env';

// Real widget queries against the test database, wrapped so a test can make
// one of them fail.
vi.mock('@/lib/analytics/metrics', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@/lib/analytics/metrics')>();
  return { ...actual, queryWidget: vi.fn(actual.queryWidget) };
});

vi.mock('@/lib/telekom', () => ({
  fetchTelekomBalance: vi.fn(),
}));

const ROUTE = '@/pages/api/admin/analytics.page';

const STAFF_IDS = WIDGETS.filter((w) => w.access === 'staff').map((w) => w.id);
const ALL_IDS = WIDGETS.map((w) => w.id);
const SUPERUSER_IDS = WIDGETS.filter((w) => w.access === 'superuser').map(
  (w) => w.id,
);

// Days nobody else writes rollups for.
const SEED_DAYS = ['2024-01-10', '2024-01-11', '2024-01-12'];

describe('GET /api/admin/analytics (integration)', () => {
  let prisma: PrismaClient;
  let superToken: string;
  let adminToken: string;
  let freeToken: string;
  const userIds: string[] = [];

  const call = async (
    token: string | null,
    query: Record<string, string> = {},
    method: RequestMethod = 'GET',
  ) => {
    const handler = (await import(ROUTE)).default;
    const { req, res } = createMocks({
      method,
      url: '/api/admin/analytics',
      query,
      headers: token ? { authorization: `Bearer ${token}` } : {},
    });
    await handler(
      req as unknown as NextApiRequest,
      res as unknown as NextApiResponse,
    );
    const raw = res._getData() as string;
    return {
      status: res._getStatusCode(),
      body: (raw ? JSON.parse(raw) : {}) as {
        success: boolean;
        message?: string;
        data?: AnalyticsResponse;
      },
    };
  };

  const realQueryWidget = async () =>
    (
      await vi.importActual<typeof import('@/lib/analytics/metrics')>(
        '@/lib/analytics/metrics',
      )
    ).queryWidget;

  const mocks = async () => ({
    queryWidget: vi.mocked(
      (await import('@/lib/analytics/metrics')).queryWidget,
    ),
    fetchTelekomBalance: vi.mocked(
      (await import('@/lib/telekom')).fetchTelekomBalance,
    ),
  });

  beforeAll(async () => {
    const { databaseUrl } = await prepareIntegrationWorker();
    prisma = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
    await prisma.$connect();

    const superuser = await createStaffPrincipal(prisma, 'SUPERUSER');
    const admin = await createStaffPrincipal(prisma, 'ADMIN');
    const free = await createStaffPrincipal(prisma, 'FREE');
    superToken = superuser.accessToken;
    adminToken = admin.accessToken;
    freeToken = free.accessToken;
    userIds.push(superuser.userId, admin.userId, free.userId);

    const rows = SEED_DAYS.flatMap((day, index) =>
      [
        { metric: 'pageviews', dimension: '', dimensionValue: '', value: 10 },
        {
          metric: 'pageviews',
          dimension: 'locale',
          dimensionValue: 'ru',
          value: 5 + index,
        },
        {
          metric: 'pageviews',
          dimension: 'locale',
          dimensionValue: 'tk',
          value: 3,
        },
        {
          metric: 'pageviews',
          dimension: 'locale',
          dimensionValue: 'en',
          value: 1,
        },
      ].map((row) => ({
        ...row,
        day: new Date(`${day}T00:00:00Z`),
        value: BigInt(row.value),
      })),
    );
    await prisma.analyticsDaily.createMany({ data: rows });
  }, 180_000);

  beforeEach(async () => {
    (await import('@/lib/analytics/adminApi')).clearAnalyticsCaches();
    const { queryWidget, fetchTelekomBalance } = await mocks();
    queryWidget.mockClear().mockImplementation(await realQueryWidget());
    fetchTelekomBalance.mockReset().mockResolvedValue(777);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  afterAll(async () => {
    await prisma.analyticsDaily
      .deleteMany({
        where: {
          day: { in: SEED_DAYS.map((day) => new Date(`${day}T00:00:00Z`)) },
        },
      })
      .catch(() => {});
    await prisma.user
      .deleteMany({ where: { id: { in: userIds } } })
      .catch(() => {});
    await prisma.$disconnect();
    await resetPrismaGlobalSingleton();
    teardownIntegrationWorker();
  });

  describe('access', () => {
    it('is 401 without a token', async () => {
      const { status, body } = await call(null);
      expect(status).toBe(401);
      expect(body.data).toBeUndefined();
    });

    it('is 401 with a token that does not verify', async () => {
      expect((await call('not-a-jwt')).status).toBe(401);
    });

    it('is 403 for a FREE user', async () => {
      const { status, body } = await call(freeToken);
      expect(status).toBe(403);
      expect(body).toEqual({ success: false, message: 'Forbidden' });
    });

    it.each(['POST', 'PUT', 'PATCH', 'DELETE'] as const)(
      'is 405 for %s',
      async (method) => {
        const { status } = await call(adminToken, {}, method);
        expect(status).toBe(405);
      },
    );
  });

  describe('defaults', () => {
    it('gives an ADMIN every staff widget for the last 30 days by day', async () => {
      const { status, body } = await call(adminToken);
      expect(status).toBe(200);
      expect(body.success).toBe(true);
      const data = body.data!;

      const { ashgabatDay, shiftDay } = await import(
        '@/lib/analytics/adminQuery'
      );
      const today = ashgabatDay();
      expect(data.to).toBe(today);
      expect(data.from).toBe(shiftDay(today, -29));
      expect(data.granularity).toBe('day');

      expect(data.widgets.map((w) => w.id)).toEqual(STAFF_IDS);
      data.widgets.forEach((result) => {
        const meta = WIDGETS.find((w) => w.id === result.id)!;
        expect(result).toMatchObject({
          kind: meta.kind,
          unit: meta.unit,
          labelKey: meta.labelKey,
        });
        expect(result.data, result.id).not.toBeNull();
        expect(result.data?.kind).toBe(meta.kind);
      });

      expect(data.userCount).toBe(await prisma.user.count());
      expect(data.telekomBalance).toBe(777);
    });

    it('gives a SUPERUSER every widget, revenue included', async () => {
      const { status, body } = await call(superToken);
      expect(status).toBe(200);
      expect(body.data!.widgets.map((w) => w.id)).toEqual(ALL_IDS);
      expect(body.data!.widgets.every((w) => w.data?.kind === w.kind)).toBe(
        true,
      );
    });
  });

  describe('widget selection', () => {
    it('never returns a superuser widget to an ADMIN, even when asked for', async () => {
      const { status, body } = await call(adminToken, {
        widgets: [...SUPERUSER_IDS, 'kpi_visitors'].join(','),
      });
      expect(status).toBe(200);
      expect(body.data!.widgets.map((w) => w.id)).toEqual(['kpi_visitors']);

      const onlyRevenue = await call(adminToken, { widgets: 'kpi_revenue' });
      expect(onlyRevenue.status).toBe(200);
      expect(onlyRevenue.body.data!.widgets).toEqual([]);

      const { queryWidget } = await mocks();
      const asked = queryWidget.mock.calls.map(([id]) => id);
      SUPERUSER_IDS.forEach((id) => expect(asked).not.toContain(id));
    });

    it('returns exactly the requested widgets, in catalog order', async () => {
      const { body } = await call(superToken, {
        widgets: 'top_products,revenue,kpi_visitors,revenue',
      });
      expect(body.data!.widgets.map((w) => w.id)).toEqual([
        'kpi_visitors',
        'revenue',
        'top_products',
      ]);
      const { queryWidget } = await mocks();
      expect(queryWidget).toHaveBeenCalledTimes(3);
    });

    it('answers from the rollups for the requested range and limit', async () => {
      const { status, body } = await call(adminToken, {
        widgets: 'kpi_pageviews,by_locale',
        from: SEED_DAYS[0],
        to: SEED_DAYS[2],
        limit: '2',
        locale: 'en',
      });
      expect(status).toBe(200);
      const [kpi, byLocale] = body.data!.widgets;
      expect(kpi.data).toMatchObject({ kind: 'kpi', value: 30 });
      expect(byLocale.data).toEqual({
        kind: 'topN',
        rows: [
          expect.objectContaining({ key: 'ru', value: 18 }),
          expect.objectContaining({ key: 'tk', value: 9 }),
        ],
      });

      const { queryWidget } = await mocks();
      expect(queryWidget).toHaveBeenCalledWith(
        'by_locale',
        {
          from: SEED_DAYS[0],
          to: SEED_DAYS[2],
          granularity: 'day',
          limit: 2,
          locale: 'en',
        },
        { ctx: expect.anything() },
      );
      // Every widget of the request shares the one context.
      const contexts = queryWidget.mock.calls.map((args) => args[2]?.ctx);
      expect(new Set(contexts).size).toBe(1);
    });
  });

  describe('validation', () => {
    it.each([
      ['an unknown widget', { widgets: 'kpi_visitors,kpi_nope' }],
      ['a malformed day', { from: '2026-1-1' }],
      ['an impossible day', { to: '2026-02-30' }],
      ['from after to', { from: '2026-11-10', to: '2026-11-01' }],
      ['a range over two years', { from: '2023-01-01', to: '2025-12-31' }],
      ['an unknown granularity', { granularity: 'year' }],
      ['a limit over 50', { limit: '51' }],
      ['a limit under 1', { limit: '0' }],
      ['a non-numeric limit', { limit: 'all' }],
    ])('is 400 for %s', async (_name, query) => {
      const { status, body } = await call(adminToken, query);
      expect(status).toBe(400);
      expect(body.success).toBe(false);
      expect(body.message).toMatch(/^Invalid/);
    });

    it('is 400 for days before 2020 or after tomorrow', async () => {
      const { ashgabatDay, shiftDay } = await import(
        '@/lib/analytics/adminQuery'
      );
      const today = ashgabatDay();
      const early = await call(adminToken, {
        from: '0001-01-01',
        to: '0001-01-31',
      });
      expect(early.status).toBe(400);
      expect(early.body.message).toMatch(/^Invalid to: .*2020-01-01/);

      const tooLate = await call(adminToken, { to: shiftDay(today, 2) });
      expect(tooLate.status).toBe(400);
      expect(tooLate.body.message).toMatch(/^Invalid to/);

      // Tomorrow is tolerated: a browser clock a little ahead.
      const tomorrow = await call(adminToken, {
        widgets: 'kpi_visitors',
        to: shiftDay(today, 1),
      });
      expect(tomorrow.status).toBe(200);
    });

    it('accepts the longest allowed range and every granularity', async () => {
      for (const granularity of ['day', 'week', 'month']) {
        // eslint-disable-next-line no-await-in-loop
        const { status, body } = await call(adminToken, {
          widgets: 'traffic',
          from: '2024-01-01',
          to: '2025-12-31',
          granularity,
        });
        expect(status).toBe(200);
        expect(body.data!.granularity).toBe(granularity);
      }
    });
  });

  describe('failures', () => {
    it('returns data: null for a failed widget and the rest intact', async () => {
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const { queryWidget } = await mocks();
      const real = await realQueryWidget();
      queryWidget.mockImplementation((id, params) =>
        id === 'traffic'
          ? Promise.reject(new Error('rollup table on fire'))
          : real(id, params),
      );

      const { status, body } = await call(adminToken);

      expect(status).toBe(200);
      const widgets = body.data!.widgets;
      expect(widgets.map((w) => w.id)).toEqual(STAFF_IDS);
      expect(widgets.find((w) => w.id === 'traffic')).toMatchObject({
        kind: 'timeseries',
        data: null,
      });
      expect(
        widgets.filter((w) => w.id !== 'traffic').every((w) => w.data != null),
      ).toBe(true);
      expect(errorSpy).toHaveBeenCalledWith(
        expect.any(String),
        expect.stringContaining('traffic'),
        expect.any(Error),
      );

      // Not cached: the next load runs the widget again.
      queryWidget.mockImplementation(real);
      const retry = await call(adminToken);
      expect(
        retry.body.data!.widgets.find((w) => w.id === 'traffic')?.data,
      ).not.toBeNull();
    });

    it('reports a null Telekom balance when Telekom fails', async () => {
      vi.spyOn(console, 'error').mockImplementation(() => {});
      const { fetchTelekomBalance } = await mocks();
      fetchTelekomBalance.mockRejectedValue(new Error('unreachable'));

      const { status, body } = await call(adminToken, {
        widgets: 'kpi_visitors',
      });

      expect(status).toBe(200);
      expect(body.data!.telekomBalance).toBeNull();
      expect(body.data!.widgets[0].data).not.toBeNull();
    });
  });

  describe('/admin/analytics page gate', () => {
    type Result = {
      redirect?: { destination: string; permanent: boolean };
      props?: { messages?: Record<string, string> };
    };

    const open = async (refreshToken: string | null, locale = 'en') => {
      // The page's getServerSideProps (index.page.tsx re-exports it).
      const { adminAnalyticsServerProps: getServerSideProps } = await import(
        '@/pages/admin/analytics/serverProps'
      );
      const { AUTH_REFRESH_COOKIE_NAME } = await import(
        '@/pages/lib/constants'
      );
      return (await getServerSideProps({
        req: {
          cookies: refreshToken
            ? { [AUTH_REFRESH_COOKIE_NAME]: refreshToken }
            : {},
        },
        res: {},
        query: {},
        resolvedUrl: '/admin/analytics',
        locale,
      } as unknown as GetServerSidePropsContext)) as Result;
    };

    const refreshTokenFor = async (userId: string, grade: UserRole) =>
      (await import('@/pages/api/utils/tokenUtils')).generateTokens(
        userId,
        grade,
      ).refreshToken;

    const home = (locale: string) => ({
      redirect: { destination: `/${locale}/`, permanent: false },
    });

    it('sends anonymous visitors and broken cookies home', async () => {
      expect(await open(null)).toEqual(home('en'));
      expect(await open('not-a-jwt', 'tk')).toEqual(home('tk'));
    });

    it('sends a FREE user home', async () => {
      const free = userIds[2];
      expect(await open(await refreshTokenFor(free, 'FREE'))).toEqual(
        home('en'),
      );
    });

    it('goes by the current grade, not the one in the cookie', async () => {
      // A FREE account holding a cookie minted while it was an ADMIN.
      const free = userIds[2];
      expect(await open(await refreshTokenFor(free, 'ADMIN'))).toEqual(
        home('en'),
      );
    });

    it('sends a deleted staff account home', async () => {
      const deleted = await createStaffPrincipal(prisma, 'SUPERUSER');
      userIds.push(deleted.userId);
      await prisma.user.update({
        where: { id: deleted.userId },
        data: { deletedAt: new Date() },
      });
      expect(
        await open(await refreshTokenFor(deleted.userId, 'SUPERUSER')),
      ).toEqual(home('en'));
    });

    it.each([
      ['ADMIN', 1],
      ['SUPERUSER', 0],
    ] as const)('renders for an %s, in their language', async (grade, at) => {
      const result = await open(
        await refreshTokenFor(userIds[at], grade),
        'ru',
      );
      expect(result.redirect).toBeUndefined();
      expect(result.props?.messages?.analytics).toBe(
        (await import('@/i18n/ru.json')).default.analytics,
      );
    });
  });

  describe('/analytics (retired)', () => {
    it('redirects to the dashboard in the same language', async () => {
      const { getServerSideProps } = await import(
        '@/pages/analytics/index.page'
      );
      const at = (locale?: string) =>
        getServerSideProps({
          req: { cookies: {} },
          res: {},
          query: {},
          resolvedUrl: '/analytics',
          locale,
        } as unknown as GetServerSidePropsContext);
      expect(await at('tk')).toEqual({
        redirect: { destination: '/tk/admin/analytics', permanent: false },
      });
      expect(await at(undefined)).toEqual({
        redirect: { destination: '/ru/admin/analytics', permanent: false },
      });
    });
  });

  describe('cache', () => {
    it('serves a repeated query from memory, separately per tier', async () => {
      const { queryWidget, fetchTelekomBalance } = await mocks();
      const query = { widgets: 'kpi_visitors,kpi_pageviews' };

      const first = await call(adminToken, query);
      const second = await call(adminToken, query);
      expect(second.body).toEqual(first.body);
      expect(queryWidget).toHaveBeenCalledTimes(2);

      await call(superToken, query);
      expect(queryWidget).toHaveBeenCalledTimes(4);

      await call(adminToken, { ...query, granularity: 'week' });
      expect(queryWidget).toHaveBeenCalledTimes(6);

      // The balance is cached on its own, across queries.
      expect(fetchTelekomBalance).toHaveBeenCalledTimes(1);
    });
  });
});
