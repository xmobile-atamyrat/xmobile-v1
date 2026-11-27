import {
  VISITOR_COOKIE,
  VISITOR_COOKIE_MAX_AGE_S,
} from '@/lib/analytics/constants';
import {
  clientIp,
  createRateLimiter,
  detectPlatform,
  enqueueAnalyticsEvent,
  isBot,
  isUuid,
  lookupAnalyticsUser,
  parseBeaconBody,
  readCookie,
  readIdentity,
  resolveLocale,
  userAgentOf,
  userIdFromRefreshCookie,
  validateClientEvent,
  type ValidClientEvent,
} from '@/lib/analytics/server';
import addCors from '@/pages/api/utils/addCors';
import { isSecureRequest } from '@/pages/api/utils/requestScheme';
import { ResponseApi } from '@/pages/lib/types';
import { Prisma } from '@prisma/client';
import cookie from 'cookie';
import type { NextApiRequest, NextApiResponse } from 'next';

/**
 * Analytics beacon ingestion (docs/analytics-design.md §3). Not called
 * `/api/analytics` or `/api/track`: ad-blocker lists match those paths.
 *
 * The client tracker posts `{ platform, locale, sentAt, events: [{ name,
 * props, ts }] }` with `navigator.sendBeacon` (a JSON Blob) or `fetch(…, {
 * keepalive: true })`. Identity comes only from the `xa_vid` / `xa_sid`
 * cookies. Everything that isn't kept (bots, no visitor cookie, invalid
 * events, and every batch of a logged-in staff user, ADMIN or SUPERUSER) is
 * dropped silently with the same 204, so a beacon never retries.
 */

/** Beacons per visitor (and address) per minute; the tracker sends ~2. */
export const EVENTS_RATE_LIMIT_PER_VISITOR = 60;
/**
 * Events (not requests) per address per minute, so rotating `xa_vid` doesn't
 * get around the visitor limit. Generous, since a carrier NAT puts many
 * phones behind one IP: the whole site averages well under 100 a minute.
 */
export const EVENTS_RATE_LIMIT_PER_IP = 300;
/**
 * Events per address per day: caps what one address can write into the raw
 * table even when it stays under the per-minute limit. Above the whole
 * site's daily volume today (10–30k), for the same NAT reason.
 */
export const EVENTS_DAILY_LIMIT_PER_IP = 50_000;
const RATE_WINDOW_MS = 60_000;
const DAY_MS = 24 * 60 * 60 * 1000;
const RATE_MAX_KEYS = 10_000;

const visitorLimiter = createRateLimiter({
  limit: EVENTS_RATE_LIMIT_PER_VISITOR,
  windowMs: RATE_WINDOW_MS,
  maxKeys: RATE_MAX_KEYS,
});
const ipLimiter = createRateLimiter({
  limit: EVENTS_RATE_LIMIT_PER_IP,
  windowMs: RATE_WINDOW_MS,
  maxKeys: RATE_MAX_KEYS,
});
const ipDailyLimiter = createRateLimiter({
  limit: EVENTS_DAILY_LIMIT_PER_IP,
  windowMs: DAY_MS,
  maxKeys: RATE_MAX_KEYS,
});

/** Clears the rate-limit windows. Tests only. */
export function resetEventsRateLimits(): void {
  visitorLimiter.reset();
  ipLimiter.reset();
  ipDailyLimiter.reset();
}

/**
 * Re-issues the visitor cookie with the attributes the client writes it with.
 * Safari (ITP) caps cookies written by JavaScript at 7 days; one set by the
 * server keeps its full year. Never mints an id: only a valid one the request
 * already carries is renewed. Not HttpOnly, the tracker reads it.
 */
function renewVisitorCookie(req: NextApiRequest, res: NextApiResponse): void {
  const raw = readCookie(req, VISITOR_COOKIE);
  if (!isUuid(raw)) return;
  res.setHeader(
    'Set-Cookie',
    cookie.serialize(VISITOR_COOKIE, raw, {
      path: '/',
      maxAge: VISITOR_COOKIE_MAX_AGE_S,
      sameSite: 'lax',
      secure: isSecureRequest(req),
    }),
  );
}

export const config = {
  api: {
    // 50 events of a few hundred bytes each; the 1 MB default invites abuse.
    bodyParser: { sizeLimit: '64kb' },
  },
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ResponseApi>,
) {
  addCors(res);

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res
      .status(405)
      .json({ success: false, message: 'Method not allowed' });
  }

  const userAgent = userAgentOf(req);
  if (isBot(userAgent)) return res.status(204).end();

  const { visitorId, sessionId } = readIdentity(req);
  if (visitorId == null) return res.status(204).end();
  renewVisitorCookie(req, res);

  // The address is only a key in memory here; it is never stored.
  const ip = clientIp(req);
  if (!visitorLimiter.hit(`${visitorId}|${ip}`)) {
    return res
      .status(429)
      .json({ success: false, message: 'Too many requests' });
  }

  const { beacon, error: bodyError } = parseBeaconBody(req.body);
  if (bodyError != null) {
    return res.status(400).json({ success: false, message: bodyError });
  }

  // Counted before validation, so junk events count against the address too.
  // An empty batch still costs one.
  const cost = Math.max(1, beacon.events.length);
  const ipOk =
    ip === '' ||
    (ipLimiter.hit(ip, undefined, cost) &&
      ipDailyLimiter.hit(ip, undefined, cost));
  if (!ipOk) {
    return res
      .status(429)
      .json({ success: false, message: 'Too many requests' });
  }

  try {
    const now = Date.now();
    const valid = beacon.events
      .map((event) => validateClientEvent(event, now, beacon.sentAt))
      .filter((event): event is ValidClientEvent => event != null);
    if (valid.length === 0) return res.status(204).end();

    let userId = await userIdFromRefreshCookie(req);
    if (userId != null) {
      const status = await lookupAnalyticsUser(userId);
      // Staff browsing the shop isn't customer traffic.
      if (status.staff) return res.status(204).end();
      // A soft-deleted account's events are kept, without the account.
      if (status.deleted) userId = null;
    }
    // The beacon knows best (it can see window.ReactNativeWebView).
    const platform = beacon.platform ?? detectPlatform(userAgent);
    const locale = resolveLocale(req, beacon.locale);

    valid.forEach((event) => {
      enqueueAnalyticsEvent({
        occurredAt: event.occurredAt,
        name: event.name,
        visitorId,
        sessionId,
        userId,
        entityId: event.entityId,
        platform,
        locale,
        props:
          event.props == null
            ? Prisma.DbNull
            : (event.props as Prisma.InputJsonValue),
      });
    });
  } catch (error) {
    // Analytics must never error back at a page; drop the batch.
    console.warn('[analytics] /api/events failed:', error);
  }
  return res.status(204).end();
}
