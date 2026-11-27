import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  SERVER_FLUSH_AT_EVENTS,
  SERVER_FLUSH_INTERVAL_MS,
} from '@/lib/analytics/constants';
import {
  AnalyticsEventRow,
  bufferedAnalyticsEventCount,
  enqueueAnalyticsEvent,
  flushAnalyticsBuffer,
  holdAnalyticsEvent,
  MAX_BUFFERED_EVENTS,
  resetAnalyticsBuffer,
  trackPendingAnalytics,
} from '@/lib/analytics/server/buffer';

const { createMany } = vi.hoisted(() => ({ createMany: vi.fn() }));

vi.mock('@/lib/dbClient', () => ({
  default: { analyticsEvent: { createMany } },
}));

const VID = '6f1c2b0e-8d4a-4c1e-9b7a-2f3d4e5a6b7c';

function row(name = 'page_view', extra: Partial<AnalyticsEventRow> = {}) {
  return {
    name,
    visitorId: VID,
    platform: 'WEB',
    locale: 'ru',
    ...extra,
  } as AnalyticsEventRow;
}

/** Rows passed to createMany across all calls, flattened. */
const writtenRows = () =>
  createMany.mock.calls.flatMap(
    ([args]) => (args as { data: AnalyticsEventRow[] }).data,
  );

describe('analytics buffer', () => {
  beforeEach(() => {
    resetAnalyticsBuffer();
    createMany.mockReset();
    createMany.mockImplementation(async ({ data }) => ({ count: data.length }));
  });

  afterEach(() => {
    resetAnalyticsBuffer();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('does not touch the database on enqueue', () => {
    enqueueAnalyticsEvent(row());
    expect(createMany).not.toHaveBeenCalled();
    expect(bufferedAnalyticsEventCount()).toBe(1);
  });

  it('writes everything queued in one createMany on flush', async () => {
    enqueueAnalyticsEvent(row('a'));
    enqueueAnalyticsEvent(row('b'));
    enqueueAnalyticsEvent(row('c'));
    await expect(flushAnalyticsBuffer()).resolves.toBe(3);
    expect(createMany).toHaveBeenCalledTimes(1);
    expect(writtenRows().map((r) => r.name)).toEqual(['a', 'b', 'c']);
    expect(bufferedAnalyticsEventCount()).toBe(0);
  });

  it('flushing an empty buffer writes nothing', async () => {
    await expect(flushAnalyticsBuffer()).resolves.toBe(0);
    expect(createMany).not.toHaveBeenCalled();
  });

  it('flushes on its own after SERVER_FLUSH_INTERVAL_MS, with an unref’d timer', async () => {
    vi.useFakeTimers();
    const unref = vi.fn();
    const realSetTimeout = setTimeout;
    const spy = vi.spyOn(globalThis, 'setTimeout').mockImplementation(((
      fn: () => void,
      ms?: number,
    ) => {
      const handle = realSetTimeout(fn, ms);
      return Object.assign(handle, { unref }) as unknown as NodeJS.Timeout;
    }) as typeof setTimeout);

    enqueueAnalyticsEvent(row());
    enqueueAnalyticsEvent(row());
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy.mock.calls[0][1]).toBe(SERVER_FLUSH_INTERVAL_MS);
    expect(unref).toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(SERVER_FLUSH_INTERVAL_MS - 1);
    expect(createMany).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(createMany).toHaveBeenCalledTimes(1);
    expect(writtenRows()).toHaveLength(2);
  });

  it(`flushes at once when ${SERVER_FLUSH_AT_EVENTS} events are queued`, async () => {
    for (let i = 0; i < SERVER_FLUSH_AT_EVENTS - 1; i += 1) {
      enqueueAnalyticsEvent(row());
    }
    expect(createMany).not.toHaveBeenCalled();
    enqueueAnalyticsEvent(row());
    expect(createMany).toHaveBeenCalledTimes(1);
    await flushAnalyticsBuffer();
    expect(writtenRows()).toHaveLength(SERVER_FLUSH_AT_EVENTS);
  });

  it('never runs two writes at once, and a flush waits for one in flight', async () => {
    let release: () => void = () => undefined;
    createMany.mockImplementationOnce(
      ({ data }) =>
        new Promise((resolve) => {
          release = () => resolve({ count: data.length });
        }),
    );
    for (let i = 0; i < SERVER_FLUSH_AT_EVENTS; i += 1) {
      enqueueAnalyticsEvent(row('first'));
    }
    expect(createMany).toHaveBeenCalledTimes(1);
    // Queued while the first write is still running.
    for (let i = 0; i < SERVER_FLUSH_AT_EVENTS + 10; i += 1) {
      enqueueAnalyticsEvent(row('second'));
    }
    expect(createMany).toHaveBeenCalledTimes(1);

    const flushed = flushAnalyticsBuffer();
    release();
    await flushed;
    expect(createMany).toHaveBeenCalledTimes(2);
    expect(writtenRows()).toHaveLength(2 * SERVER_FLUSH_AT_EVENTS + 10);
    expect(bufferedAnalyticsEventCount()).toBe(0);
  });

  it('splits a large flush into chunks of at most 1000 rows', async () => {
    createMany.mockImplementation(async ({ data }) => ({ count: data.length }));
    // Keep the size-triggered flush out of the way: hold the first write.
    let release: () => void = () => undefined;
    createMany.mockImplementationOnce(
      ({ data }) =>
        new Promise((resolve) => {
          release = () => resolve({ count: data.length });
        }),
    );
    for (let i = 0; i < 3000; i += 1) enqueueAnalyticsEvent(row());
    const flushed = flushAnalyticsBuffer();
    release();
    await flushed;
    const sizes = createMany.mock.calls.map(
      ([args]) => (args as { data: unknown[] }).data.length,
    );
    expect(Math.max(...sizes)).toBeLessThanOrEqual(1000);
    expect(sizes.reduce((a, b) => a + b, 0)).toBe(3000);
  });

  it('a failed flush logs once, drops the batch and never rejects', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    createMany.mockRejectedValue(new Error('db down'));

    enqueueAnalyticsEvent(row());
    await expect(flushAnalyticsBuffer()).resolves.toBe(0);
    enqueueAnalyticsEvent(row());
    await expect(flushAnalyticsBuffer()).resolves.toBe(0);

    expect(error).toHaveBeenCalledTimes(1);
    expect(String(error.mock.calls[0][0])).toContain('[analytics]');
    expect(bufferedAnalyticsEventCount()).toBe(0);

    // Recovery: the next flush writes, and a later failure logs again.
    createMany.mockImplementation(async ({ data }) => ({ count: data.length }));
    enqueueAnalyticsEvent(row());
    await expect(flushAnalyticsBuffer()).resolves.toBe(1);
    createMany.mockRejectedValue(new Error('db down again'));
    enqueueAnalyticsEvent(row());
    await flushAnalyticsBuffer();
    expect(error).toHaveBeenCalledTimes(2);
  });

  it(`caps the buffer at ${MAX_BUFFERED_EVENTS} rows while the database is stuck`, async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    let release: () => void = () => undefined;
    createMany.mockImplementation(
      ({ data }) =>
        new Promise((resolve) => {
          release = () => resolve({ count: data.length });
        }),
    );
    // The first SERVER_FLUSH_AT_EVENTS go into the stuck write; the rest queue.
    const total = SERVER_FLUSH_AT_EVENTS + MAX_BUFFERED_EVENTS + 250;
    for (let i = 0; i < total; i += 1) enqueueAnalyticsEvent(row());
    expect(bufferedAnalyticsEventCount()).toBe(MAX_BUFFERED_EVENTS);
    expect(warn).toHaveBeenCalledTimes(1);

    createMany.mockImplementation(async ({ data }) => ({ count: data.length }));
    release();
    await flushAnalyticsBuffer();
    expect(writtenRows()).toHaveLength(
      SERVER_FLUSH_AT_EVENTS + MAX_BUFFERED_EVENTS,
    );
  });

  describe('held rows', () => {
    it('a later row under the same key replaces the held one', async () => {
      holdAnalyticsEvent(
        'search:v',
        row('search', { props: { q: 'sam' } }),
        3000,
      );
      holdAnalyticsEvent(
        'search:v',
        row('search', { props: { q: 'samsung' } }),
        3000,
      );
      holdAnalyticsEvent(
        'search:w',
        row('search', { props: { q: 'nokia' } }),
        3000,
      );
      expect(bufferedAnalyticsEventCount()).toBe(2);
      await flushAnalyticsBuffer();
      expect(writtenRows().map((r) => (r.props as { q: string }).q)).toEqual([
        'samsung',
        'nokia',
      ]);
    });

    it('is queued once the key has been quiet for quietMs', async () => {
      vi.useFakeTimers();
      holdAnalyticsEvent('k', row('a'), 3000);
      await vi.advanceTimersByTimeAsync(2000);
      holdAnalyticsEvent('k', row('b'), 3000);
      await vi.advanceTimersByTimeAsync(2999);
      expect(createMany).not.toHaveBeenCalled();
      await vi.advanceTimersByTimeAsync(1 + SERVER_FLUSH_INTERVAL_MS);
      expect(writtenRows().map((r) => r.name)).toEqual(['b']);
    });

    it(`holds at most ${MAX_BUFFERED_EVENTS} keys, releasing the oldest`, async () => {
      for (let i = 0; i < MAX_BUFFERED_EVENTS + 5; i += 1) {
        holdAnalyticsEvent(`k${i}`, row(`n${i}`), 60_000);
      }
      // 5 released into the queue, MAX still held.
      expect(bufferedAnalyticsEventCount()).toBe(MAX_BUFFERED_EVENTS + 5);
      await flushAnalyticsBuffer();
      const names = writtenRows().map((r) => r.name);
      expect(names.slice(0, 5)).toEqual(['n0', 'n1', 'n2', 'n3', 'n4']);
      expect(names).toHaveLength(MAX_BUFFERED_EVENTS + 5);
    });
  });

  it('flush waits for pending tracking work to land its rows', async () => {
    let finish: () => void = () => undefined;
    trackPendingAnalytics(
      new Promise<void>((resolve) => {
        finish = () => {
          enqueueAnalyticsEvent(row('late'));
          resolve();
        };
      }),
    );
    const flushed = flushAnalyticsBuffer();
    finish();
    await expect(flushed).resolves.toBe(1);
    expect(writtenRows().map((r) => r.name)).toEqual(['late']);
  });

  it('keeps one buffer on globalThis across module reloads', async () => {
    enqueueAnalyticsEvent(row('before-reload'));
    vi.resetModules();
    const fresh = await import('@/lib/analytics/server/buffer');
    expect(fresh.bufferedAnalyticsEventCount()).toBe(1);
    await fresh.flushAnalyticsBuffer();
    expect(writtenRows().map((r) => r.name)).toEqual(['before-reload']);
  });
});
