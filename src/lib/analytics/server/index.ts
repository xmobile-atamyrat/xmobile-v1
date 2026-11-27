/**
 * Server-side analytics: ingestion helpers for `POST /api/events` and
 * `trackServer()` for events API handlers record themselves. Server only; the
 * browser tracker lives in `src/lib/analytics/client.ts`.
 */
export {
  bufferedAnalyticsEventCount,
  enqueueAnalyticsEvent,
  flushAnalyticsBuffer,
  holdAnalyticsEvent,
  MAX_BUFFERED_EVENTS,
  MAX_INSERT_SPLITS,
  resetAnalyticsBuffer,
  trackPendingAnalytics,
} from './buffer';
export type { AnalyticsEventRow, HeldAnalyticsEvent } from './buffer';
export {
  CLIENT_MAX_HOLD_MS,
  CLIENT_TS_MAX_AGE_MS,
  CLIENT_TS_MAX_SKEW_MS,
  parseBeaconBody,
  resolveOccurredAt,
  validateClientEvent,
} from './ingest';
export type {
  BeaconParseResult,
  ParsedBeacon,
  ValidClientEvent,
} from './ingest';
export { createRateLimiter } from './rateLimit';
export type { RateLimiter, RateLimiterOptions } from './rateLimit';
export {
  clientIp,
  isAnalyticsLocale,
  isUuid,
  readCookie,
  readIdentity,
  resolveLocale,
  userAgentOf,
  userIdFromRefreshCookie,
} from './request';
export type { AnalyticsIdentity, AnalyticsRequest } from './request';
export {
  buildServerEventRow,
  MAX_SEARCH_QUERY_LENGTH,
  normalizeSearchQuery,
  resetSearchTracking,
  SEARCH_REPEAT_WINDOW_MS,
  SEARCH_SETTLE_MS,
  trackSearch,
  trackServer,
} from './track';
export type { TrackSearchOptions, TrackServerOptions } from './track';
export { sanitizeString, sanitizeValue, truncateUtf16 } from './sanitize';
export {
  cachedAnalyticsUser,
  isStaffUser,
  lookupAnalyticsUser,
  resetStaffGradeCache,
  STAFF_GRADE_MAX_KEYS,
  STAFF_GRADE_TTL_MS,
} from './staff';
export type { AnalyticsUserStatus } from './staff';
export { detectPlatform, isBot } from './userAgent';
export { detachAnalyticsFromUsers } from './userData';
