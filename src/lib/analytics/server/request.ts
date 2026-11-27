import type { IncomingHttpHeaders } from 'node:http';

import {
  ANALYTICS_LOCALES,
  AnalyticsLocale,
  DEFAULT_ANALYTICS_LOCALE,
  SESSION_COOKIE,
  VISITOR_COOKIE,
} from '@/lib/analytics/constants';
import { verifyToken } from '@/pages/api/utils/authMiddleware';
import {
  AUTH_REFRESH_COOKIE_NAME,
  LOCALE_COOKIE_NAME,
} from '@/pages/lib/constants';

/**
 * The parts of a request analytics reads. A `NextApiRequest` fits; so does a
 * plain `IncomingMessage` (the ws-server's upgrade request), whose cookies are
 * parsed from the header instead.
 */
export interface AnalyticsRequest {
  headers: IncomingHttpHeaders;
  cookies?: Partial<Record<string, string>>;
  socket?: { remoteAddress?: string | undefined } | null;
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const isUuid = (value: unknown): value is string =>
  typeof value === 'string' && UUID_PATTERN.test(value);

function headerValue(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? '';
  return value ?? '';
}

export function readCookie(
  req: AnalyticsRequest,
  name: string,
): string | undefined {
  if (req.cookies != null) return req.cookies[name] ?? undefined;
  const header = headerValue(req.headers.cookie);
  // First match wins, like the `cookie` package Next uses.
  const found = header
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name}=`));
  if (found == null) return undefined;
  const raw = found.slice(name.length + 1);
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

export function userAgentOf(req: AnalyticsRequest): string {
  return headerValue(req.headers['user-agent']);
}

export const isAnalyticsLocale = (value: unknown): value is AnalyticsLocale =>
  typeof value === 'string' &&
  (ANALYTICS_LOCALES as readonly string[]).includes(value);

function localeFromReferer(referer: string): AnalyticsLocale | null {
  if (referer === '') return null;
  try {
    const [first] = new URL(referer).pathname.split('/').filter(Boolean);
    return isAnalyticsLocale(first) ? first : null;
  } catch {
    return null;
  }
}

/**
 * The visitor's locale: an explicit value (the beacon's `locale`), else the
 * `NEXT_LOCALE` cookie, else the first path segment of the Referer (`/en/…`),
 * else the default. Only the app's own locales are returned.
 */
export function resolveLocale(
  req: AnalyticsRequest,
  explicit?: unknown,
): AnalyticsLocale {
  if (isAnalyticsLocale(explicit)) return explicit;
  const cookie = readCookie(req, LOCALE_COOKIE_NAME);
  if (isAnalyticsLocale(cookie)) return cookie;
  return (
    localeFromReferer(headerValue(req.headers.referer)) ??
    DEFAULT_ANALYTICS_LOCALE
  );
}

export interface AnalyticsIdentity {
  /** The `xa_vid` cookie, or null when it is missing or not a UUID. */
  visitorId: string | null;
  /** The `xa_sid` cookie, or null when it is missing or not a UUID. */
  sessionId: string | null;
}

/** Identity comes only from the cookies the client tracker sets. */
export function readIdentity(req: AnalyticsRequest): AnalyticsIdentity {
  const visitorId = readCookie(req, VISITOR_COOKIE);
  const sessionId = readCookie(req, SESSION_COOKIE);
  return {
    visitorId: isUuid(visitorId) ? visitorId.toLowerCase() : null,
    sessionId: isUuid(sessionId) ? sessionId.toLowerCase() : null,
  };
}

/**
 * The client's address, for in-memory rate limiting only; it is never stored.
 * nginx sets X-Real-IP; same order as `localeFromIp` on the home page.
 */
export function clientIp(req: AnalyticsRequest): string {
  const raw =
    headerValue(req.headers['x-real-ip']) ||
    headerValue(req.headers['x-forwarded-for']) ||
    req.socket?.remoteAddress ||
    '';
  return raw.split(',')[0].trim();
}

/**
 * The logged-in user, read from the refresh-token cookie. Beacons carry no
 * Authorization header, so this is the only signal. Null on any failure.
 */
export async function userIdFromRefreshCookie(
  req: AnalyticsRequest,
): Promise<string | null> {
  const token = readCookie(req, AUTH_REFRESH_COOKIE_NAME);
  const secret = process.env.REFRESH_TOKEN_SECRET;
  if (!token || !secret) return null;
  try {
    const { userId } = await verifyToken(token, secret);
    return typeof userId === 'string' && userId !== '' ? userId : null;
  } catch {
    return null;
  }
}
