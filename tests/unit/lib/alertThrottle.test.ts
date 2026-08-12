import { describe, expect, it } from 'vitest';

import { createAlertThrottle } from '@/lib/alertThrottle';

const WINDOW = 300_000; // 5 min

function makeThrottle(overrides = {}) {
  return createAlertThrottle({
    windowMs: WINDOW,
    maxPerWindow: 20,
    maxKeys: 500,
    ...overrides,
  });
}

describe('createAlertThrottle', () => {
  it('passes a first-seen alert straight through', () => {
    const throttle = makeThrottle();
    expect(throttle.admit('boom', 0)).toEqual(['boom']);
  });

  it('suppresses repeats of the same alert inside the window', () => {
    const throttle = makeThrottle();

    // The retry job re-attempts the same notification 3 more times; each one
    // produces a byte-identical line. Only the first should reach Slack.
    expect(throttle.admit('notif n1 failed', 0)).toEqual(['notif n1 failed']);
    expect(throttle.admit('notif n1 failed', 60_000)).toEqual([]);
    expect(throttle.admit('notif n1 failed', 120_000)).toEqual([]);
    expect(throttle.admit('notif n1 failed', 180_000)).toEqual([]);
  });

  it('keeps distinct alerts independent', () => {
    const throttle = makeThrottle();
    expect(throttle.admit('notif n1 failed', 0)).toEqual(['notif n1 failed']);
    expect(throttle.admit('notif n2 failed', 1)).toEqual(['notif n2 failed']);
  });

  it('reports what it swallowed when the window rolls over', () => {
    const throttle = makeThrottle();
    throttle.admit('notif n1 failed', 0);
    throttle.admit('notif n1 failed', 10);
    throttle.admit('notif n1 failed', 20);

    const out = throttle.admit('something else', WINDOW + 1);

    expect(out).toHaveLength(2);
    expect(out[0]).toMatch(/2 .*suppressed/i);
    expect(out[1]).toBe('something else');
  });

  it('lets the same alert through again in a fresh window', () => {
    const throttle = makeThrottle();
    throttle.admit('notif n1 failed', 0);
    expect(throttle.admit('notif n1 failed', 100)).toEqual([]);

    const out = throttle.admit('notif n1 failed', WINDOW + 1);
    expect(out[out.length - 1]).toBe('notif n1 failed');
  });

  it('caps total alerts per window so a 100-row retry tick cannot flood', () => {
    const throttle = makeThrottle({ maxPerWindow: 3 });

    const admitted = Array.from({ length: 100 }, (_, i) =>
      throttle.admit(`notif n${i} failed`, i),
    ).filter((out) => out.length > 0);

    // 100 distinct notifications, but Slack only hears the first 3.
    expect(admitted).toHaveLength(3);
  });

  it('accounts for rate-capped alerts in the rollover summary', () => {
    const throttle = makeThrottle({ maxPerWindow: 1 });
    throttle.admit('a', 0);
    throttle.admit('b', 1);
    throttle.admit('c', 2);

    const out = throttle.admit('d', WINDOW + 1);
    expect(out[0]).toMatch(/2 .*suppressed/i);
  });

  it('bounds memory when flooded with unique keys', () => {
    const throttle = makeThrottle({ maxKeys: 10, maxPerWindow: 100_000 });
    for (let i = 0; i < 50; i += 1) {
      throttle.admit(`unique ${i}`, i);
    }
    expect(throttle.size()).toBeLessThanOrEqual(10);
  });
});
