import { describe, expect, it } from 'vitest';

import {
  ADMIN_ONLINE_WINDOW_MS,
  dayRangeUtc,
  isOnline,
  localDay,
  parseFeedQuery,
  shiftDay,
} from '@/lib/adminActivityQueries';

describe('dayRangeUtc', () => {
  it('turns local Ashgabat days into UTC instants, end exclusive', () => {
    const range = dayRangeUtc('2026-03-02', '2026-03-02');
    expect(range.gte?.toISOString()).toBe('2026-03-01T19:00:00.000Z');
    expect(range.lt?.toISOString()).toBe('2026-03-02T19:00:00.000Z');
  });

  it('supports open-ended ranges', () => {
    expect(dayRangeUtc('2026-03-02', undefined).lt).toBeUndefined();
    expect(dayRangeUtc(undefined, '2026-03-02').gte).toBeUndefined();
  });
});

describe('localDay', () => {
  it('uses the Ashgabat calendar day, not the UTC one', () => {
    expect(localDay(new Date('2026-03-01T20:00:00Z'))).toBe('2026-03-02');
    expect(localDay(new Date('2026-03-01T18:59:00Z'))).toBe('2026-03-01');
  });
});

describe('shiftDay', () => {
  it('moves a calendar day backwards across month and year edges', () => {
    expect(shiftDay('2026-03-01', -1)).toBe('2026-02-28');
    expect(shiftDay('2026-01-01', -1)).toBe('2025-12-31');
    expect(shiftDay('2026-10-05', -364)).toBe('2025-10-06');
  });
});

describe('isOnline', () => {
  const now = new Date('2026-10-05T10:00:00Z');

  it('is online inside the window and offline outside it', () => {
    expect(
      isOnline(new Date(now.getTime() - ADMIN_ONLINE_WINDOW_MS + 1), now),
    ).toBe(true);
    expect(
      isOnline(new Date(now.getTime() - ADMIN_ONLINE_WINDOW_MS - 1), now),
    ).toBe(false);
  });

  it('is offline when never seen', () => {
    expect(isOnline(null, now)).toBe(false);
  });
});

describe('parseFeedQuery', () => {
  it('applies defaults', () => {
    expect(parseFeedQuery({})).toEqual({
      ok: true,
      value: { limit: 50 },
    });
  });

  it('accepts valid filters and clamps the limit', () => {
    expect(
      parseFeedQuery({
        userId: 'u1',
        entity: 'PRODUCT',
        action: 'UPDATE',
        from: '2026-03-01',
        to: '2026-03-31',
        limit: '5000',
        cursor: 'abc',
      }),
    ).toEqual({
      ok: true,
      value: {
        userId: 'u1',
        entity: 'PRODUCT',
        action: 'UPDATE',
        from: '2026-03-01',
        to: '2026-03-31',
        limit: 100,
        cursor: 'abc',
      },
    });
  });

  it.each([
    [{ entity: 'NOPE' }],
    [{ action: 'NOPE' }],
    [{ from: '2026-13-40' }],
    [{ to: 'yesterday' }],
    [{ from: '2026-03-10', to: '2026-03-01' }],
    [{ limit: '0' }],
    [{ limit: 'abc' }],
  ])('rejects %j', (query) => {
    expect(parseFeedQuery(query).ok).toBe(false);
  });
});
