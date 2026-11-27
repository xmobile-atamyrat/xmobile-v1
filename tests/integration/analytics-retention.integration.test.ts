import { PrismaClient } from '@prisma/client';
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import { resetPrismaGlobalSingleton } from './helpers/reset-prisma-global';
import {
  insertEvents,
  useSessionTimeZone,
  wipeAnalytics,
} from './shared/analytics-fixture';
import {
  prepareIntegrationWorker,
  teardownIntegrationWorker,
} from './shared/worker-env';

const NOW = new Date('2025-02-05T07:00:00.000Z');
// NOW minus exactly 90 days.
const CUTOFF = new Date('2024-11-07T07:00:00.000Z');
const VISITOR = '00000000-0000-4000-8000-0000000000aa';

describe('analytics raw-event retention (integration)', () => {
  let prisma: PrismaClient;
  let retention: typeof import('@/lib/analytics/retention');

  const seed = async (oldCount: number) => {
    await wipeAnalytics(prisma);
    await insertEvents(prisma, [
      ...Array.from({ length: oldCount }, (_, i) => ({
        at: new Date(CUTOFF.getTime() - (i + 1) * 60_000).toISOString(),
        name: 'page_view',
        v: VISITOR,
      })),
      // 1 ms before the cut-off: deleted. Exactly at it: kept.
      {
        at: new Date(CUTOFF.getTime() - 1).toISOString(),
        name: 'page_view',
        v: VISITOR,
      },
      { at: CUTOFF.toISOString(), name: 'page_view', v: VISITOR },
      { at: '2025-02-05T06:00:00.000Z', name: 'search', v: VISITOR },
    ]);
    await prisma.analyticsDaily.create({
      data: {
        day: new Date('2024-10-01T00:00:00Z'),
        metric: 'pageviews',
        value: 123n,
      },
    });
  };

  const remaining = async () =>
    (
      await prisma.analyticsEvent.findMany({
        orderBy: { occurredAt: 'asc' },
        select: { occurredAt: true },
      })
    ).map((e) => e.occurredAt.toISOString());

  beforeAll(async () => {
    const { databaseUrl: baseUrl } = await prepareIntegrationWorker();
    // The cut-off is a zone-less UTC timestamp: a non-UTC session mustn't move it.
    const databaseUrl = useSessionTimeZone(baseUrl);
    prisma = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
    await prisma.$connect();
    retention = await import('@/lib/analytics/retention');
  });

  beforeEach(() => vi.spyOn(console, 'log').mockImplementation(() => {}));

  afterAll(async () => {
    await wipeAnalytics(prisma);
    await prisma.$disconnect();
    await resetPrismaGlobalSingleton();
    teardownIntegrationWorker();
  });

  it('deletes only raw events older than 90 days, in batches, keeping rollups', async () => {
    await seed(6); // 6 + the one 1 ms before the cut-off = 7 old rows

    const result = await retention.pruneAnalyticsEvents({
      now: NOW,
      batchSize: 3,
    });

    expect(result).toEqual({ deleted: 7, batches: 3 });
    expect(await remaining()).toEqual([
      CUTOFF.toISOString(),
      '2025-02-05T06:00:00.000Z',
    ]);
    expect(await prisma.analyticsDaily.count()).toBe(1);
  });

  it('runs one extra empty batch when the old rows fill the last batch exactly', async () => {
    await seed(5); // 6 old rows
    expect(
      await retention.pruneAnalyticsEvents({ now: NOW, batchSize: 3 }),
    ).toEqual({ deleted: 6, batches: 3 });
  });

  it('stops at maxBatches and finishes on the next run', async () => {
    await seed(9); // 10 old rows
    expect(
      await retention.pruneAnalyticsEvents({
        now: NOW,
        batchSize: 2,
        maxBatches: 3,
      }),
    ).toEqual({ deleted: 6, batches: 3 });
    expect(await remaining()).toHaveLength(6);
    expect(
      await retention.pruneAnalyticsEvents({ now: NOW, batchSize: 2 }),
    ).toEqual({ deleted: 4, batches: 3 });
    expect(await remaining()).toHaveLength(2);
  });

  it('deletes the oldest rows first', async () => {
    await seed(4); // 5 old rows
    await retention.pruneAnalyticsEvents({
      now: NOW,
      batchSize: 2,
      maxBatches: 1,
    });
    const left = await remaining();
    // The two oldest (4 and 3 minutes before the cut-off) went first.
    expect(left[0]).toBe(new Date(CUTOFF.getTime() - 2 * 60_000).toISOString());
  });

  it('the analytics-retention job prunes with the given clock', async () => {
    await seed(2);
    const job = await import(
      '../../scripts/batch-runner/jobs/analytics-retention'
    );
    expect(await job.runAnalyticsRetention(NOW)).toEqual({
      deleted: 3,
      batches: 1,
    });
    expect(await job.runAnalyticsRetention(NOW)).toEqual({
      deleted: 0,
      batches: 1,
    });
    expect(await remaining()).toHaveLength(2);
  });
});
