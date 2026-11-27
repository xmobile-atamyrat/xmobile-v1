import {
  clientIp,
  createRateLimiter,
  detectPlatform,
  enqueueAnalyticsEvent,
  isBot,
  isStaffUser,
  parseBeaconBody,
  readIdentity,
  resolveLocale,
  userAgentOf,
  userIdFromRefreshCookie,
  validateClientEvent,
  type ValidClientEvent,
} from '@/lib/analytics/server';
import addCors from '@/pages/api/utils/addCors';
import { ResponseApi } from '@/pages/lib/types';
import { Prisma } from '@prisma/client';
import type { NextApiRequest, NextApiResponse } from 'next';

/**
 * Analytics beacon ingestion (docs/analytics-design.md §3). Not called
 * `/api/analytics` or `/api/track`: ad-blocker lists match those paths.
 *
 * The client tracker posts `{ platform, locale, events: [{ name, props, ts }] }`
 * with `navigator.sendBeacon` (a JSON Blob) or `fetch(…, { keepalive: true })`.
 * Identity comes only from the `xa_vid` / `xa_sid` cookies. Everything that
 * isn't kept (bots, no visitor cookie, invalid events, and every batch of a
 * logged-in staff user, ADMIN or SUPERUSER) is dropped silently with the same
 * 204, so a beacon never retries.
 */

/** Beacons per visitor (and address) per minute; the tracker sends ~2. */
export const EVENTS_RATE_LIMIT_PER_VISITOR = 60;
/** Per address: generous, since a carrier NAT puts many phones behind one IP. */
export const EVENTS_RATE_LIMIT_PER_IP = 1200;
const RATE_WINDOW_MS = 60_000;
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

/** Clears the rate-limit windows. Tests only. */
export function resetEventsRateLimits(): void {
  visitorLimiter.reset();
  ipLimiter.reset();
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

  // The address is only a key in memory here; it is never stored.
  const ip = clientIp(req);
  const visitorOk = visitorLimiter.hit(`${visitorId}|${ip}`);
  const ipOk = ip === '' || ipLimiter.hit(ip);
  if (!visitorOk || !ipOk) {
    return res
      .status(429)
      .json({ success: false, message: 'Too many requests' });
  }

  const { beacon, error: bodyError } = parseBeaconBody(req.body);
  if (bodyError != null) {
    return res.status(400).json({ success: false, message: bodyError });
  }

  try {
    const now = Date.now();
    const valid = beacon.events
      .map((event) => validateClientEvent(event, now))
      .filter((event): event is ValidClientEvent => event != null);
    if (valid.length === 0) return res.status(204).end();

    const userId = await userIdFromRefreshCookie(req);
    // Staff browsing the shop isn't customer traffic.
    if (userId != null && (await isStaffUser(userId))) {
      return res.status(204).end();
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
