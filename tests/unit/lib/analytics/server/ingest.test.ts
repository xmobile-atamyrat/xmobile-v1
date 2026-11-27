import { describe, expect, it } from 'vitest';

import { MAX_EVENTS_PER_BATCH } from '@/lib/analytics/constants';
import {
  CLIENT_TS_MAX_AGE_MS,
  CLIENT_TS_MAX_SKEW_MS,
  parseBeaconBody,
  resolveOccurredAt,
  validateClientEvent,
} from '@/lib/analytics/server/ingest';

const NOW = Date.UTC(2026, 10, 27, 12, 0, 0);

describe('resolveOccurredAt', () => {
  it('keeps a client timestamp inside [now − 1h, now + 1 min]', () => {
    expect(resolveOccurredAt(NOW, NOW).getTime()).toBe(NOW);
    const oldest = NOW - CLIENT_TS_MAX_AGE_MS;
    const newest = NOW + CLIENT_TS_MAX_SKEW_MS;
    expect(resolveOccurredAt(oldest, NOW).getTime()).toBe(oldest);
    expect(resolveOccurredAt(newest, NOW).getTime()).toBe(newest);
    expect(resolveOccurredAt(NOW - 5 * 60_000, NOW).getTime()).toBe(
      NOW - 5 * 60_000,
    );
  });

  it('uses server time for a timestamp outside the window', () => {
    expect(
      resolveOccurredAt(NOW - CLIENT_TS_MAX_AGE_MS - 1, NOW).getTime(),
    ).toBe(NOW);
    expect(
      resolveOccurredAt(NOW + CLIENT_TS_MAX_SKEW_MS + 1, NOW).getTime(),
    ).toBe(NOW);
    expect(resolveOccurredAt(0, NOW).getTime()).toBe(NOW);
  });

  it.each([
    ['a string', String(NOW)],
    ['NaN', Number.NaN],
    ['Infinity', Number.POSITIVE_INFINITY],
    ['null', null],
    ['undefined', undefined],
  ])('uses server time for %s', (_label, ts) => {
    expect(resolveOccurredAt(ts, NOW).getTime()).toBe(NOW);
  });

  it('drops fractional milliseconds', () => {
    expect(resolveOccurredAt(NOW - 0.7, NOW).getTime()).toBe(NOW - 1);
  });
});

describe('parseBeaconBody', () => {
  const body = {
    platform: 'APP',
    locale: 'tk',
    events: [{ name: 'page_view', props: { path: '/' }, ts: NOW }],
  };

  it('accepts a parsed JSON object', () => {
    expect(parseBeaconBody(body)).toEqual({
      beacon: { platform: 'APP', locale: 'tk', events: body.events },
    });
  });

  it('accepts a string body holding JSON (text/plain beacons)', () => {
    expect(parseBeaconBody(JSON.stringify(body)).beacon?.events).toHaveLength(
      1,
    );
  });

  it('accepts a Buffer body holding JSON', () => {
    expect(
      parseBeaconBody(Buffer.from(JSON.stringify(body))).beacon?.platform,
    ).toBe('APP');
  });

  it('nulls an unknown platform instead of rejecting the batch', () => {
    expect(parseBeaconBody({ ...body, platform: 'IOS' }).beacon?.platform).toBe(
      null,
    );
  });

  it.each([
    ['invalid JSON', '{"events": ['],
    ['an empty string', ''],
    ['null', null],
    ['an array', [body]],
    ['a number', 7],
    ['no events', { platform: 'WEB' }],
    ['events not an array', { events: { name: 'page_view' } }],
  ])('rejects %s', (_label, value) => {
    expect(parseBeaconBody(value).error).toEqual(expect.any(String));
  });

  it(`accepts exactly ${MAX_EVENTS_PER_BATCH} events and rejects more`, () => {
    const event = body.events[0];
    expect(
      parseBeaconBody({
        events: Array(MAX_EVENTS_PER_BATCH).fill(event),
      }).error,
    ).toBeUndefined();
    expect(
      parseBeaconBody({
        events: Array(MAX_EVENTS_PER_BATCH + 1).fill(event),
      }).error,
    ).toMatch(/At most/);
  });
});

describe('validateClientEvent', () => {
  it('splits the entity prop into entityId', () => {
    expect(
      validateClientEvent(
        { name: 'product_view', props: { productId: 'p1' }, ts: NOW },
        NOW,
      ),
    ).toEqual({
      name: 'product_view',
      entityId: 'p1',
      props: null,
      occurredAt: new Date(NOW),
    });
  });

  it('keeps the remaining props and strips unknown keys', () => {
    expect(
      validateClientEvent(
        {
          name: 'page_view',
          props: { path: '/en', referrer: 'google.com', evil: 'x' },
          ts: NOW,
        },
        NOW,
      ),
    ).toMatchObject({
      name: 'page_view',
      entityId: null,
      props: { path: '/en', referrer: 'google.com' },
    });
  });

  it.each(['search', 'cart_add', 'order_placed', 'chat_started', 'signup'])(
    'drops the server-only event %s',
    (name) => {
      expect(
        validateClientEvent(
          { name, props: { orderId: 'o1', q: 'x', results: 1 } },
          NOW,
        ),
      ).toBeNull();
    },
  );

  it.each([
    ['an unknown name', { name: 'purchase', props: {} }],
    ['a missing name', { props: { path: '/' } }],
    ['invalid props', { name: 'product_view', props: { productId: '' } }],
    ['missing required props', { name: 'category_view', props: {} }],
    [
      'a too-long path',
      { name: 'page_view', props: { path: 'x'.repeat(301) } },
    ],
    ['a non-object', 'page_view'],
    ['null', null],
    ['prototype keys', { name: 'toString', props: {} }],
  ])('drops %s', (_label, raw) => {
    expect(validateClientEvent(raw, NOW)).toBeNull();
  });

  it('falls back to server time for a bad timestamp', () => {
    expect(
      validateClientEvent(
        { name: 'page_view', props: { path: '/' }, ts: NOW - 2 * 3_600_000 },
        NOW,
      )?.occurredAt,
    ).toEqual(new Date(NOW));
  });
});
