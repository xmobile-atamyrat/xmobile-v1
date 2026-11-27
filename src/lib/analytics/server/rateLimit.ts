export interface RateLimiterOptions {
  /** Hits allowed per key per window. */
  limit: number;
  windowMs: number;
  /** Keys tracked at most; the oldest windows are forgotten first. */
  maxKeys: number;
}

export interface RateLimiter {
  /** Counts a hit for `key`; false once the key is over its limit. */
  hit(key: string, now?: number): boolean;
  /** Keys currently tracked. */
  size(): number;
  reset(): void;
}

/**
 * A fixed-window counter per key, in memory only. Memory is bounded by
 * `maxKeys`: a window is re-inserted when it starts, so the Map's insertion
 * order is oldest window first and eviction just takes from the front. A key
 * evicted early only gets a fresh window, which errs on the side of letting
 * analytics through.
 */
export function createRateLimiter({
  limit,
  windowMs,
  maxKeys,
}: RateLimiterOptions): RateLimiter {
  const windows = new Map<string, { count: number; resetAt: number }>();

  return {
    hit(key, now = Date.now()) {
      const current = windows.get(key);
      if (current != null && current.resetAt > now) {
        current.count += 1;
        return current.count <= limit;
      }
      windows.delete(key);
      windows.set(key, { count: 1, resetAt: now + windowMs });
      while (windows.size > maxKeys) {
        const oldest = windows.keys().next().value as string;
        windows.delete(oldest);
      }
      return limit >= 1;
    },
    size: () => windows.size,
    reset: () => windows.clear(),
  };
}
