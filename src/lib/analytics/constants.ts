/** First-party visitor cookie: a random UUID, kept 1 year. */
export const VISITOR_COOKIE = 'xa_vid';
export const VISITOR_COOKIE_MAX_AGE_S = 365 * 24 * 60 * 60;

/** Session cookie: a random UUID, renewed on activity, expires after 30 min idle. */
export const SESSION_COOKIE = 'xa_sid';
export const SESSION_IDLE_S = 30 * 60;

/** Raw `AnalyticsEvent` rows older than this are deleted nightly. */
export const RAW_RETENTION_DAYS = 90;

/** Locales the app serves; anything else is stored as the default. */
export const ANALYTICS_LOCALES = ['ru', 'en', 'tk', 'tr', 'ch'] as const;
export type AnalyticsLocale = (typeof ANALYTICS_LOCALES)[number];
export const DEFAULT_ANALYTICS_LOCALE: AnalyticsLocale = 'ru';

/** Ingestion limits for `POST /api/events`. */
export const MAX_EVENTS_PER_BATCH = 50;

/** Client tracker batching. */
export const CLIENT_FLUSH_INTERVAL_MS = 30_000;
export const CLIENT_FLUSH_AT_EVENTS = 20;

/** Server buffer batching. */
export const SERVER_FLUSH_INTERVAL_MS = 5_000;
export const SERVER_FLUSH_AT_EVENTS = 500;
