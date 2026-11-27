import { describe, expect, it } from 'vitest';

import { createRateLimiter } from '@/lib/analytics/server/rateLimit';

describe('createRateLimiter', () => {
  it('allows `limit` hits per window, then refuses', () => {
    const limiter = createRateLimiter({
      limit: 3,
      windowMs: 1000,
      maxKeys: 10,
    });
    expect([1, 2, 3, 4, 5].map(() => limiter.hit('a', 0))).toEqual([
      true,
      true,
      true,
      false,
      false,
    ]);
  });

  it('counts keys separately', () => {
    const limiter = createRateLimiter({
      limit: 1,
      windowMs: 1000,
      maxKeys: 10,
    });
    expect(limiter.hit('a', 0)).toBe(true);
    expect(limiter.hit('b', 0)).toBe(true);
    expect(limiter.hit('a', 0)).toBe(false);
  });

  it('starts a fresh window once the old one ends', () => {
    const limiter = createRateLimiter({
      limit: 1,
      windowMs: 1000,
      maxKeys: 10,
    });
    expect(limiter.hit('a', 0)).toBe(true);
    expect(limiter.hit('a', 999)).toBe(false);
    expect(limiter.hit('a', 1000)).toBe(true);
    expect(limiter.hit('a', 1500)).toBe(false);
  });

  it('never tracks more than maxKeys, forgetting the oldest windows', () => {
    const limiter = createRateLimiter({
      limit: 1,
      windowMs: 60_000,
      maxKeys: 3,
    });
    ['a', 'b', 'c', 'd', 'e'].forEach((key, i) => limiter.hit(key, i));
    expect(limiter.size()).toBe(3);
    // 'a' was evicted, so it gets a new window; 'e' is still limited.
    expect(limiter.hit('a', 10)).toBe(true);
    expect(limiter.hit('e', 10)).toBe(false);
    expect(limiter.size()).toBe(3);
  });

  it('stays bounded under a flood of unique keys', () => {
    const limiter = createRateLimiter({
      limit: 5,
      windowMs: 60_000,
      maxKeys: 100,
    });
    for (let i = 0; i < 10_000; i += 1) limiter.hit(`k${i}`, i);
    expect(limiter.size()).toBe(100);
  });

  it('reset forgets everything', () => {
    const limiter = createRateLimiter({
      limit: 1,
      windowMs: 1000,
      maxKeys: 10,
    });
    limiter.hit('a', 0);
    limiter.reset();
    expect(limiter.size()).toBe(0);
    expect(limiter.hit('a', 0)).toBe(true);
  });
});
