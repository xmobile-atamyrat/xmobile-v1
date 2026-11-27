import { describe, expect, it } from 'vitest';

import { MAX_EVENTS_PER_BATCH } from '@/lib/analytics/constants';
import {
  CLIENT_MAX_HOLD_MS,
  CLIENT_TS_MAX_AGE_MS,
  CLIENT_TS_MAX_SKEW_MS,
  parseBeaconBody,
  resolveOccurredAt,
  validateClientEvent,
} from '@/lib/analytics/server/ingest';

const NOW = Date.UTC(2026, 10, 27, 12, 0, 0);
const PRODUCT_ID = '0b9a7e6c-3f1d-4e2a-9c8b-7a6d5e4f3a2b';
const CATEGORY_ID = '1c2d3e4f-5a6b-4c7d-8e9f-0a1b2c3d4e5f';

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

  describe('with the client send time (sentAt)', () => {
    it('moves the timestamp onto the server clock', () => {
      // Phone clock 2 days ahead.
      const skew = 2 * 86_400_000;
      expect(
        resolveOccurredAt(NOW + skew - 5_000, NOW, NOW + skew).getTime(),
      ).toBe(NOW - 5_000);
      // Phone clock 5 hours behind.
      expect(
        resolveOccurredAt(
          NOW - 5 * 3_600_000 - 1_000,
          NOW,
          NOW - 5 * 3_600_000,
        ).getTime(),
      ).toBe(NOW - 1_000);
    });

    it('never puts an event in the future', () => {
      // ts after sentAt makes no sense; clamped to now.
      expect(resolveOccurredAt(NOW + 10_000, NOW, NOW).getTime()).toBe(NOW);
    });

    it('never goes further back than 1h plus the client hold time', () => {
      const oldest = NOW - CLIENT_TS_MAX_AGE_MS - CLIENT_MAX_HOLD_MS;
      expect(resolveOccurredAt(NOW - 5 * 3_600_000, NOW, NOW).getTime()).toBe(
        oldest,
      );
      expect(resolveOccurredAt(oldest + 1, NOW, NOW).getTime()).toBe(
        oldest + 1,
      );
    });

    it('falls back to the old window without a usable sentAt', () => {
      const ts = NOW - 2 * 3_600_000;
      expect(resolveOccurredAt(ts, NOW, null).getTime()).toBe(NOW);
      expect(resolveOccurredAt(ts, NOW, 'x').getTime()).toBe(NOW);
      expect(resolveOccurredAt(ts, NOW, 0).getTime()).toBe(NOW);
      expect(resolveOccurredAt('x', NOW, NOW).getTime()).toBe(NOW);
    });
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
      beacon: {
        platform: 'APP',
        locale: 'tk',
        sentAt: null,
        events: body.events,
      },
    });
  });

  it('reads the client send time, ignoring one that is not a number', () => {
    expect(parseBeaconBody({ ...body, sentAt: NOW }).beacon?.sentAt).toBe(NOW);
    expect(
      parseBeaconBody({ ...body, sentAt: String(NOW) }).beacon?.sentAt,
    ).toBeNull();
    expect(
      parseBeaconBody({ ...body, sentAt: Number.NaN }).beacon?.sentAt,
    ).toBeNull();
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
        { name: 'product_view', props: { productId: PRODUCT_ID }, ts: NOW },
        NOW,
      ),
    ).toEqual({
      name: 'product_view',
      entityId: PRODUCT_ID,
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

  it('shifts the timestamp by the client clock offset when sentAt is given', () => {
    // A phone 3 hours behind: ts and sentAt are both on its clock.
    const skew = -3 * 3_600_000;
    const sentAt = NOW + skew;
    const ts = sentAt - 20_000; // tracked 20s before the beacon left
    expect(
      validateClientEvent(
        { name: 'page_view', props: { path: '/' }, ts },
        NOW,
        sentAt,
      )?.occurredAt,
    ).toEqual(new Date(NOW - 20_000));
  });

  describe('sanitizes strings Postgres would reject', () => {
    it.each([
      ['a NUL', '/a\u0000b', '/ab'],
      ['a lone high surrogate', '/a\uD83Db', '/a\uFFFDb'],
      ['a lone low surrogate', '/a\uDE00b', '/a\uFFFDb'],
    ])('in the path: %s', (_label, path, expected) => {
      expect(
        validateClientEvent({ name: 'page_view', props: { path } }, NOW)?.props,
      ).toEqual({ path: expected });
    });

    it('keeps a valid surrogate pair', () => {
      expect(
        validateClientEvent(
          { name: 'page_view', props: { path: '/\uD83D\uDE00' } },
          NOW,
        )?.props,
      ).toEqual({ path: '/\uD83D\uDE00' });
    });

    it('strips a NUL from a productId', () => {
      expect(
        validateClientEvent(
          { name: 'product_view', props: { productId: `${PRODUCT_ID}\u0000` } },
          NOW,
        )?.entityId,
      ).toBe(PRODUCT_ID);
    });

    it('drops a productId with a lone surrogate (not a UUID once cleaned)', () => {
      expect(
        validateClientEvent(
          { name: 'product_view', props: { productId: `${PRODUCT_ID}\uD83D` } },
          NOW,
        ),
      ).toBeNull();
    });
  });

  describe('dimension values', () => {
    it.each([
      ['not a UUID', 'p1'],
      ['a slug', 'iphone-15-pro'],
      ['too long', `${PRODUCT_ID}0`],
    ])('drops an entity view whose id is %s', (_label, id) => {
      expect(
        validateClientEvent(
          { name: 'product_view', props: { productId: id } },
          NOW,
        ),
      ).toBeNull();
      expect(
        validateClientEvent(
          { name: 'category_view', props: { categoryId: id } },
          NOW,
        ),
      ).toBeNull();
    });

    it('accepts a category UUID', () => {
      expect(
        validateClientEvent(
          { name: 'category_view', props: { categoryId: CATEGORY_ID } },
          NOW,
        )?.entityId,
      ).toBe(CATEGORY_ID);
    });

    it.each([
      ['uppercase', 'Google.com'],
      ['a port', 'example.com:8080'],
      ['a path', 'example.com/x'],
      ['spaces', 'my site'],
      ['too long', `${'a'.repeat(98)}.com`],
      ['empty', ''],
      ['a number', 5],
    ])(
      'drops a referrer with %s but keeps the page view',
      (_label, referrer) => {
        expect(
          validateClientEvent(
            { name: 'page_view', props: { path: '/', referrer } },
            NOW,
          )?.props,
        ).toEqual({ path: '/' });
      },
    );

    it('keeps a host-name referrer', () => {
      expect(
        validateClientEvent(
          {
            name: 'page_view',
            props: { path: '/', referrer: 'xn--80ak6aa92e.com' },
          },
          NOW,
        )?.props,
      ).toEqual({ path: '/', referrer: 'xn--80ak6aa92e.com' });
    });
  });
});
