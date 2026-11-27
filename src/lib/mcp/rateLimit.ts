import { createRateLimiter } from '@/lib/analytics/server/rateLimit';

/** Per grant, per minute. Far above what a person chatting can produce. */
export const REQUESTS_PER_MINUTE = 120;

/**
 * A fixed window per grant. A client retrying through 429s is refused until
 * its window ends, then starts a fresh one. A grant is a connection a
 * superuser approved, so 1000 tracked keys is far more than there will be.
 */
const limiter = createRateLimiter({
  limit: REQUESTS_PER_MINUTE,
  windowMs: 60_000,
  maxKeys: 1000,
});

export function overRateLimit(grantId: string, now = Date.now()): boolean {
  return !limiter.hit(grantId, now);
}
