import type { AnalyticsPlatform } from '@prisma/client';

import { MAX_EVENTS_PER_BATCH } from '@/lib/analytics/constants';
import {
  ClientEventName,
  events,
  isClientEventName,
  splitEntity,
} from '@/lib/analytics/events';

/** How far back a client timestamp is believed: beacons queue up offline. */
export const CLIENT_TS_MAX_AGE_MS = 60 * 60 * 1000;
/** How far ahead: phone clocks drift. */
export const CLIENT_TS_MAX_SKEW_MS = 60 * 1000;

/**
 * The client's epoch-ms timestamp when it's within [now − 1h, now + 1 min],
 * else the server's time: a phone with a wrong clock must not put events on
 * another day.
 */
export function resolveOccurredAt(ts: unknown, now: number = Date.now()): Date {
  if (
    typeof ts === 'number' &&
    Number.isFinite(ts) &&
    ts >= now - CLIENT_TS_MAX_AGE_MS &&
    ts <= now + CLIENT_TS_MAX_SKEW_MS
  ) {
    return new Date(Math.trunc(ts));
  }
  return new Date(now);
}

export interface ParsedBeacon {
  platform: AnalyticsPlatform | null;
  locale: unknown;
  events: unknown[];
}

/** Exactly one of `beacon` (parsed) or `error` (why the body is a 400). */
export type BeaconParseResult =
  | { beacon: ParsedBeacon; error?: undefined }
  | { beacon?: undefined; error: string };

/**
 * Reads the beacon body. `sendBeacon` with a JSON Blob arrives parsed; a
 * text/plain body (or no content type) arrives as a string or Buffer holding
 * the JSON. A batch over MAX_EVENTS_PER_BATCH is rejected whole rather than
 * truncated: the client never sends one, so it is a bug or abuse.
 */
export function parseBeaconBody(body: unknown): BeaconParseResult {
  let value = body;
  if (Buffer.isBuffer(value)) value = value.toString('utf8');
  if (typeof value === 'string') {
    try {
      value = JSON.parse(value);
    } catch {
      return { error: 'Invalid JSON' };
    }
  }
  if (value == null || typeof value !== 'object' || Array.isArray(value)) {
    return { error: 'Body must be an object' };
  }
  const { platform, locale, events: list } = value as Record<string, unknown>;
  if (!Array.isArray(list)) {
    return { error: '`events` must be an array' };
  }
  if (list.length > MAX_EVENTS_PER_BATCH) {
    return { error: `At most ${MAX_EVENTS_PER_BATCH} events per batch` };
  }
  return {
    beacon: {
      platform: platform === 'WEB' || platform === 'APP' ? platform : null,
      locale,
      events: list,
    },
  };
}

export interface ValidClientEvent {
  name: ClientEventName;
  entityId: string | null;
  props: Record<string, unknown> | null;
  occurredAt: Date;
}

/**
 * One beacon event, validated against the catalog, or null to drop it. Only
 * client event names pass: server events (`order_placed`, `search`, …) can't
 * be posted, so they can't be faked.
 */
export function validateClientEvent(
  raw: unknown,
  now: number = Date.now(),
): ValidClientEvent | null {
  if (raw == null || typeof raw !== 'object') return null;
  const { name, props, ts } = raw as Record<string, unknown>;
  if (!isClientEventName(name)) return null;
  const parsed = events[name].safeParse(props ?? {});
  if (!parsed.success) return null;
  return {
    name,
    ...splitEntity(name, parsed.data as Record<string, unknown>),
    occurredAt: resolveOccurredAt(ts, now),
  };
}
