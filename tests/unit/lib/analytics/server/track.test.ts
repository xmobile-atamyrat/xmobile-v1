import jwt from 'jsonwebtoken';
import { Prisma } from '@prisma/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  AnalyticsEventRow,
  bufferedAnalyticsEventCount,
  flushAnalyticsBuffer,
  resetAnalyticsBuffer,
} from '@/lib/analytics/server/buffer';
import type { AnalyticsRequest } from '@/lib/analytics/server/request';
import {
  resetStaffGradeCache,
  STAFF_GRADE_TTL_MS,
} from '@/lib/analytics/server/staff';
import {
  buildServerEventRow,
  normalizeSearchQuery,
  resetSearchTracking,
  SEARCH_SETTLE_MS,
  trackSearch,
  trackServer,
} from '@/lib/analytics/server/track';

const { createMany, findUnique } = vi.hoisted(() => ({
  createMany: vi.fn(),
  findUnique: vi.fn(),
}));

vi.mock('@/lib/dbClient', () => ({
  default: { analyticsEvent: { createMany }, user: { findUnique } },
}));

const VID = '6f1c2b0e-8d4a-4c1e-9b7a-2f3d4e5a6b7c';
const PRODUCT_ID = '0b9a7e6c-3f1d-4e2a-9c8b-7a6d5e4f3a2b';
const SID = 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d';
const BROWSER =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const ANDROID_WEBVIEW =
  'Mozilla/5.0 (Linux; Android 13; SM-A135F Build/TP1A.220624.014; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/119.0.6045.163 Mobile Safari/537.36';

function req(
  cookies: Record<string, string> = { xa_vid: VID, xa_sid: SID },
  headers: AnalyticsRequest['headers'] = { 'user-agent': BROWSER },
): AnalyticsRequest {
  return { headers, cookies };
}

const writtenRows = () =>
  createMany.mock.calls.flatMap(
    ([args]) => (args as { data: AnalyticsEventRow[] }).data,
  );

beforeEach(() => {
  resetAnalyticsBuffer();
  resetSearchTracking();
  resetStaffGradeCache();
  createMany.mockReset();
  createMany.mockImplementation(async ({ data }) => ({ count: data.length }));
  findUnique.mockReset();
  findUnique.mockResolvedValue({ grade: 'FREE', deletedAt: null });
});

afterEach(() => {
  resetAnalyticsBuffer();
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe('buildServerEventRow', () => {
  it('fills identity, platform, locale and the entity column', () => {
    const row = buildServerEventRow(
      req(
        { xa_vid: VID, xa_sid: SID, NEXT_LOCALE: 'tk' },
        { 'user-agent': ANDROID_WEBVIEW },
      ),
      'cart_add',
      { productId: PRODUCT_ID, qty: 2 },
      { userId: 'u1' },
    );
    expect(row).toMatchObject({
      name: 'cart_add',
      visitorId: VID,
      sessionId: SID,
      userId: 'u1',
      entityId: PRODUCT_ID,
      platform: 'APP',
      locale: 'tk',
      props: { qty: 2 },
    });
    expect(row?.occurredAt).toBeInstanceOf(Date);
  });

  it('stores props as SQL NULL when nothing is left after the entity', () => {
    const row = buildServerEventRow(req(), 'order_placed', { orderId: 'o1' });
    expect(row).toMatchObject({ entityId: 'o1', userId: null });
    expect(row?.props).toBe(Prisma.DbNull);
    expect(buildServerEventRow(req(), 'signup', {})?.props).toBe(Prisma.DbNull);
  });

  it('allows a missing session cookie', () => {
    expect(
      buildServerEventRow(req({ xa_vid: VID }), 'signup', {})?.sessionId,
    ).toBeNull();
  });

  it('skips bots', () => {
    expect(
      buildServerEventRow(
        req(undefined, { 'user-agent': 'curl/8.0' }),
        'signup',
        {},
      ),
    ).toBeNull();
    expect(buildServerEventRow(req(undefined, {}), 'signup', {})).toBeNull();
  });

  it('skips a request without a valid visitor cookie', () => {
    expect(buildServerEventRow(req({}), 'signup', {})).toBeNull();
    expect(
      buildServerEventRow(req({ xa_vid: 'not-a-uuid' }), 'signup', {}),
    ).toBeNull();
  });

  it('sanitizes strings Postgres would reject', () => {
    const row = buildServerEventRow(req(), 'cart_add', {
      productId: `${PRODUCT_ID}\u0000`,
      qty: 1,
    });
    expect(row?.entityId).toBe(PRODUCT_ID);
    expect(
      buildServerEventRow(req(), 'order_placed', { orderId: 'o\uD83D1' })
        ?.entityId,
    ).toBe('o\uFFFD1');
  });

  it('skips a cart_add whose productId is not a UUID', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(
      buildServerEventRow(req(), 'cart_add', { productId: 'p1', qty: 1 }),
    ).toBeNull();
  });

  it('takes the locale from a same-origin Referer before the cookie', () => {
    const row = buildServerEventRow(
      req(
        { xa_vid: VID, NEXT_LOCALE: 'tk' },
        {
          'user-agent': BROWSER,
          host: 'shop.tm',
          referer: 'https://shop.tm/en/product/x',
        },
      ),
      'signup',
      {},
    );
    expect(row?.locale).toBe('en');
    // An unprefixed page is the default locale, whatever the cookie says.
    expect(
      buildServerEventRow(
        req(
          { xa_vid: VID, NEXT_LOCALE: 'tk' },
          {
            'user-agent': BROWSER,
            host: 'shop.tm',
            referer: 'https://shop.tm/',
          },
        ),
        'signup',
        {},
      )?.locale,
    ).toBe('ru');
  });

  it('skips invalid props with a warning, not an error', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(
      buildServerEventRow(req(), 'cart_add', { productId: PRODUCT_ID, qty: 0 }),
    ).toBeNull();
    expect(warn).toHaveBeenCalledTimes(1);
    expect(error).not.toHaveBeenCalled();
  });
});

describe('trackServer', () => {
  it('queues without touching the database', async () => {
    trackServer(req(), 'order_placed', { orderId: 'o1' });
    expect(createMany).not.toHaveBeenCalled();
    expect(findUnique).not.toHaveBeenCalled();
    expect(bufferedAnalyticsEventCount()).toBe(1);
    await flushAnalyticsBuffer();
    expect(writtenRows()).toEqual([
      expect.objectContaining({ name: 'order_placed', entityId: 'o1' }),
    ]);
  });

  describe('staff users', () => {
    it('checks the grade in the background and records a FREE user', async () => {
      trackServer(req(), 'order_placed', { orderId: 'o1' }, { userId: 'u1' });
      expect(createMany).not.toHaveBeenCalled();
      await flushAnalyticsBuffer();
      expect(findUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'u1' } }),
      );
      expect(writtenRows()).toEqual([
        expect.objectContaining({ name: 'order_placed', userId: 'u1' }),
      ]);
    });

    it.each(['ADMIN', 'SUPERUSER'])(
      'drops every event of a %s',
      async (grade) => {
        findUnique.mockResolvedValue({ grade, deletedAt: null });
        trackServer(
          req(),
          'cart_add',
          { productId: PRODUCT_ID, qty: 1 },
          { userId: 'a1' },
        );
        trackServer(req(), 'chat_started', {}, { userId: 'a1' });
        await flushAnalyticsBuffer();
        // Cached now: dropped without another lookup or a pending promise.
        trackServer(req(), 'order_placed', { orderId: 'o1' }, { userId: 'a1' });
        expect(bufferedAnalyticsEventCount()).toBe(0);
        await flushAnalyticsBuffer();

        expect(writtenRows()).toEqual([]);
        expect(findUnique).toHaveBeenCalledTimes(1);
      },
    );

    it('queues a cached FREE user synchronously', async () => {
      trackServer(req(), 'signup', {}, { userId: 'u1' });
      await flushAnalyticsBuffer();
      trackServer(req(), 'chat_started', {}, { userId: 'u1' });
      expect(bufferedAnalyticsEventCount()).toBe(1);
      expect(findUnique).toHaveBeenCalledTimes(1);
    });

    it('looks the grade up again after the cache expires', async () => {
      vi.useFakeTimers({ toFake: ['Date'] });
      vi.setSystemTime(new Date('2026-11-27T10:00:00Z'));
      trackServer(req(), 'signup', {}, { userId: 'u1' });
      await flushAnalyticsBuffer();

      // Promoted meanwhile: picked up once the cached FREE expires.
      findUnique.mockResolvedValue({ grade: 'ADMIN', deletedAt: null });
      vi.setSystemTime(
        new Date(Date.parse('2026-11-27T10:00:00Z') + STAFF_GRADE_TTL_MS),
      );
      trackServer(req(), 'chat_started', {}, { userId: 'u1' });
      await flushAnalyticsBuffer();

      expect(writtenRows().map((row) => row.name)).toEqual(['signup']);
      expect(findUnique).toHaveBeenCalledTimes(2);
    });

    it('records the event when the lookup fails, and never throws', async () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      findUnique.mockRejectedValue(new Error('db down'));
      expect(() =>
        trackServer(req(), 'signup', {}, { userId: 'u1' }),
      ).not.toThrow();
      await flushAnalyticsBuffer();
      expect(writtenRows()).toHaveLength(1);
      expect(warn).toHaveBeenCalled();
      // A failure isn't cached.
      findUnique.mockResolvedValue({ grade: 'ADMIN', deletedAt: null });
      trackServer(req(), 'chat_started', {}, { userId: 'u1' });
      await flushAnalyticsBuffer();
      expect(writtenRows()).toHaveLength(1);
    });

    it('drops staff searches even without a bearer token', async () => {
      findUnique.mockResolvedValue({ grade: 'ADMIN', deletedAt: null });
      trackSearch(req(), 'iphone', { results: 3, userId: 'a1' });
      await flushAnalyticsBuffer();
      expect(writtenRows()).toEqual([]);
    });
  });

  describe('deleted accounts', () => {
    it('records a soft-deleted user anonymously', async () => {
      findUnique.mockResolvedValue({ grade: 'FREE', deletedAt: new Date() });
      trackServer(req(), 'chat_started', {}, { userId: 'gone' });
      await flushAnalyticsBuffer();
      // Cached: the second event needs no lookup and is anonymous too.
      trackServer(req(), 'signup', {}, { userId: 'gone' });
      await flushAnalyticsBuffer();
      expect(writtenRows().map((r) => [r.name, r.userId])).toEqual([
        ['chat_started', null],
        ['signup', null],
      ]);
      expect(findUnique).toHaveBeenCalledTimes(1);
    });

    it('records a user that no longer exists anonymously', async () => {
      findUnique.mockResolvedValue(null);
      trackServer(req(), 'chat_started', {}, { userId: 'purged' });
      await flushAnalyticsBuffer();
      expect(writtenRows()).toEqual([
        expect.objectContaining({ name: 'chat_started', userId: null }),
      ]);
    });

    it('a soft-deleted former admin is not treated as staff', async () => {
      findUnique.mockResolvedValue({ grade: 'ADMIN', deletedAt: new Date() });
      trackServer(req(), 'chat_started', {}, { userId: 'a1' });
      await flushAnalyticsBuffer();
      expect(writtenRows()).toEqual([
        expect.objectContaining({ name: 'chat_started', userId: null }),
      ]);
    });

    it('drops the userId of a deleted account from a search', async () => {
      findUnique.mockResolvedValue({ grade: 'FREE', deletedAt: new Date() });
      trackSearch(req(), 'nokia', { results: 1, userId: 'gone' });
      await flushAnalyticsBuffer();
      expect(writtenRows()).toEqual([
        expect.objectContaining({ name: 'search', userId: null }),
      ]);
    });
  });

  it('returns undefined synchronously (fire-and-forget)', () => {
    expect(trackServer(req(), 'signup', {})).toBeUndefined();
  });

  it('never throws, even on a broken request object', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const broken = {
      get headers(): never {
        throw new Error('boom');
      },
    } as unknown as AnalyticsRequest;
    expect(() => trackServer(broken, 'signup', {})).not.toThrow();
    expect(() =>
      trackServer(null as unknown as AnalyticsRequest, 'signup', {}),
    ).not.toThrow();
    expect(bufferedAnalyticsEventCount()).toBe(0);
  });

  it('never throws when the props are garbage', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(() =>
      trackServer(
        req(),
        'cart_add',
        null as unknown as { productId: string; qty: number },
      ),
    ).not.toThrow();
    expect(bufferedAnalyticsEventCount()).toBe(0);
  });
});

describe('normalizeSearchQuery', () => {
  it.each([
    ['  iPhone   15  Pro ', 'iphone 15 pro'],
    ['SAMSUNG\tGalaxy\nS24', 'samsung galaxy s24'],
    ['Телефон', 'телефон'],
    ['   ', ''],
    ['', ''],
  ])('%j → %j', (raw, expected) => {
    expect(normalizeSearchQuery(raw)).toBe(expected);
  });

  it('caps at 100 characters without a trailing space', () => {
    expect(normalizeSearchQuery('a'.repeat(150))).toHaveLength(100);
    expect(normalizeSearchQuery(`${'a'.repeat(99)} b`)).toBe('a'.repeat(99));
  });

  it('returns empty for non-strings (e.g. a repeated query param)', () => {
    expect(normalizeSearchQuery(['a', 'b'])).toBe('');
    expect(normalizeSearchQuery(undefined)).toBe('');
    expect(normalizeSearchQuery(5)).toBe('');
  });
});

describe('trackSearch', () => {
  it('records the normalised term and result count', async () => {
    trackSearch(req(), '  Galaxy  S24 ', { results: 3, userId: 'u1' });
    await flushAnalyticsBuffer();
    expect(writtenRows()).toEqual([
      expect.objectContaining({
        name: 'search',
        userId: 'u1',
        entityId: null,
        props: { q: 'galaxy s24', results: 3 },
      }),
    ]);
  });

  it('runs a lazy count only for a tracked visitor', async () => {
    const count = vi.fn().mockResolvedValue(42);
    trackSearch(req({}), 'phone', { results: count });
    trackSearch(req(undefined, { 'user-agent': 'Googlebot/2.1' }), 'phone', {
      results: count,
    });
    trackSearch(req(), '   ', { results: count });
    expect(count).not.toHaveBeenCalled();

    trackSearch(req(), 'phone', { results: count });
    await flushAnalyticsBuffer();
    expect(count).toHaveBeenCalledTimes(1);
    expect(writtenRows()[0].props).toEqual({ q: 'phone', results: 42 });
  });

  it('records zero results', async () => {
    trackSearch(req(), 'qwertyuiop', { results: 0 });
    await flushAnalyticsBuffer();
    expect(writtenRows()[0].props).toEqual({ q: 'qwertyuiop', results: 0 });
  });

  it('keeps only the term a visitor settled on while typing', async () => {
    vi.useFakeTimers();
    trackSearch(req(), 'sam', { results: 10 });
    await vi.advanceTimersByTimeAsync(600);
    trackSearch(req(), 'samsu', { results: 8 });
    await vi.advanceTimersByTimeAsync(600);
    trackSearch(req(), 'samsung', { results: 8 });
    await vi.advanceTimersByTimeAsync(SEARCH_SETTLE_MS + 5000);
    expect(writtenRows().map((r) => (r.props as { q: string }).q)).toEqual([
      'samsung',
    ]);
  });

  it('keeps separate visitors apart', async () => {
    const other = 'b1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d';
    trackSearch(req(), 'nokia', { results: 1 });
    trackSearch(req({ xa_vid: other }), 'nokia', { results: 1 });
    await flushAnalyticsBuffer();
    expect(
      writtenRows()
        .map((r) => r.visitorId)
        .sort(),
    ).toEqual([VID, other].sort());
  });

  it('does not count a visitor repeating the same term (sort/filter refetch)', async () => {
    trackSearch(req(), 'iphone', { results: 5 });
    await flushAnalyticsBuffer();
    trackSearch(req(), 'IPHONE ', { results: 2 });
    await flushAnalyticsBuffer();
    trackSearch(req(), 'iphone 15', { results: 2 });
    await flushAnalyticsBuffer();
    expect(writtenRows().map((r) => (r.props as { q: string }).q)).toEqual([
      'iphone',
      'iphone 15',
    ]);
  });

  it('reads userId from the refresh cookie when the caller has none', async () => {
    vi.stubEnv('REFRESH_TOKEN_SECRET', 'unit-secret');
    const token = jwt.sign({ userId: 'cookie-user' }, 'unit-secret');
    trackSearch(req({ xa_vid: VID, REFRESH_TOKEN: token }), 'case', {
      results: 1,
    });
    await flushAnalyticsBuffer();
    expect(writtenRows()[0].userId).toBe('cookie-user');
  });

  it('swallows a failing count query', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    trackSearch(req(), 'phone', {
      results: () => Promise.reject(new Error('db down')),
    });
    await expect(flushAnalyticsBuffer()).resolves.toBe(0);
    expect(warn).toHaveBeenCalled();
  });

  it('records the final term when an earlier keystroke resolves later', async () => {
    vi.useFakeTimers();
    // "sa" matches a lot: its count is slow. "samsung" arrives later but its
    // result is known at once. The order the work finishes in must not matter.
    let finishSa: (n: number) => void = () => undefined;
    const slowCount = vi.fn(
      () =>
        new Promise<number>((resolve) => {
          finishSa = resolve;
        }),
    );
    trackSearch(req(), 'sa', { results: slowCount });
    await vi.advanceTimersByTimeAsync(400);
    trackSearch(req(), 'samsung', { results: 8 });
    await vi.advanceTimersByTimeAsync(SEARCH_SETTLE_MS + 5000);
    finishSa(500);
    await vi.advanceTimersByTimeAsync(SEARCH_SETTLE_MS + 5000);
    await flushAnalyticsBuffer();

    expect(writtenRows().map((r) => r.props)).toEqual([
      { q: 'samsung', results: 8 },
    ]);
    // The broad prefix was replaced before it was released: no count for it.
    expect(slowCount).not.toHaveBeenCalled();
  });

  it('runs the count only when the held search is released', async () => {
    vi.useFakeTimers();
    const count = vi.fn().mockResolvedValue(3);
    trackSearch(req(), 'iphone', { results: count });
    await vi.advanceTimersByTimeAsync(SEARCH_SETTLE_MS - 1);
    expect(count).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(count).toHaveBeenCalledTimes(1);
  });

  it('remembers only the searches that were recorded', async () => {
    vi.useFakeTimers();
    trackSearch(req(), 'sa', { results: 100 });
    trackSearch(req(), 'samsung', { results: 8 });
    await vi.advanceTimersByTimeAsync(SEARCH_SETTLE_MS);
    // "samsung" was recorded: a refetch of it (new sort) isn't.
    trackSearch(req(), 'samsung', { results: 8 });
    await vi.advanceTimersByTimeAsync(SEARCH_SETTLE_MS);
    // "sa" never was (it was replaced while typing), so searching it on
    // purpose now counts.
    trackSearch(req(), 'sa', { results: 100 });
    await vi.advanceTimersByTimeAsync(SEARCH_SETTLE_MS);
    await flushAnalyticsBuffer();
    expect(writtenRows().map((r) => (r.props as { q: string }).q)).toEqual([
      'samsung',
      'sa',
    ]);
  });

  it('dates the event when the search arrived, not when it was released', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-27T10:00:00Z'));
    trackSearch(req(), 'nokia', { results: 1 });
    await vi.advanceTimersByTimeAsync(SEARCH_SETTLE_MS + 1000);
    await flushAnalyticsBuffer();
    expect(writtenRows()[0].occurredAt).toEqual(
      new Date('2026-11-27T10:00:00Z'),
    );
  });

  it.each([
    ['a NUL', 'gal\u0000axy', 'galaxy'],
    ['a lone surrogate', 'phone\uD83D', 'phone\uFFFD'],
  ])('sanitizes %s in the search term', async (_label, raw, q) => {
    trackSearch(req(), raw, { results: 1 });
    await flushAnalyticsBuffer();
    expect(writtenRows()[0].props).toEqual({ q, results: 1 });
  });

  it('caps the term without splitting a surrogate pair', async () => {
    trackSearch(req(), `${'a'.repeat(99)}😀`, { results: 1 });
    await flushAnalyticsBuffer();
    expect((writtenRows()[0].props as { q: string }).q).toBe('a'.repeat(99));
  });
});
