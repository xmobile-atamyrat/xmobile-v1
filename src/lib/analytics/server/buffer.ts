import type { Prisma } from '@prisma/client';

import {
  SERVER_FLUSH_AT_EVENTS,
  SERVER_FLUSH_INTERVAL_MS,
} from '@/lib/analytics/constants';
import dbClient from '@/lib/dbClient';

export type AnalyticsEventRow = Prisma.AnalyticsEventCreateManyInput;

/**
 * Rows held in memory at most. At 5s flushes that's far above normal traffic,
 * so it only bites while the database is unreachable: new rows are dropped
 * instead of growing the heap on a 4 GB VM. Also bounds the held rows.
 */
export const MAX_BUFFERED_EVENTS = 5000;

/** Rows per `createMany`, well under Postgres's 65535 bind parameters. */
const INSERT_CHUNK = 1000;

interface HeldRow {
  row: AnalyticsEventRow;
  timer: ReturnType<typeof setTimeout>;
}

interface BufferState {
  rows: AnalyticsEventRow[];
  held: Map<string, HeldRow>;
  /** Tracking work still resolving its row (e.g. a count query). */
  pending: Set<Promise<unknown>>;
  timer: ReturnType<typeof setTimeout> | null;
  inFlight: Promise<number> | null;
  /** A failing streak logs once, not on every flush. */
  failing: boolean;
  dropping: boolean;
}

// On globalThis so `next dev` hot reloads (and test module resets) keep one
// buffer instead of orphaning rows in an old module instance.
const globalForAnalytics = globalThis as typeof globalThis & {
  analyticsBuffer?: BufferState;
};

function state(): BufferState {
  if (globalForAnalytics.analyticsBuffer == null) {
    globalForAnalytics.analyticsBuffer = {
      rows: [],
      held: new Map(),
      pending: new Set(),
      timer: null,
      inFlight: null,
      failing: false,
      dropping: false,
    };
  }
  return globalForAnalytics.analyticsBuffer;
}

async function writeRows(rows: AnalyticsEventRow[]): Promise<number> {
  const s = state();
  let written = 0;
  try {
    for (let i = 0; i < rows.length; i += INSERT_CHUNK) {
      // Sequential on purpose: one connection, one statement at a time.
      // eslint-disable-next-line no-await-in-loop
      const { count } = await dbClient.analyticsEvent.createMany({
        data: rows.slice(i, i + INSERT_CHUNK),
      });
      written += count;
    }
    s.failing = false;
  } catch (error) {
    // Analytics is best-effort: the batch is dropped, never retried, so an
    // outage can't pile rows up in memory.
    if (!s.failing) {
      console.error(
        `[analytics] flush failed, dropped ${rows.length - written} events:`,
        error,
      );
    }
    s.failing = true;
  }
  return written;
}

/**
 * Writes the queue with batched `createMany` calls. Waits out a flush already
 * running, then takes what queued meanwhile, so writes never overlap and the
 * caller sees its rows in the table once this resolves.
 */
async function flushQueued(s: BufferState): Promise<number> {
  if (s.timer != null) {
    clearTimeout(s.timer);
    s.timer = null;
  }
  let written = 0;
  while (s.inFlight != null || s.rows.length > 0) {
    if (s.inFlight != null) {
      // eslint-disable-next-line no-await-in-loop
      await s.inFlight.catch(() => 0);
    } else {
      const write = writeRows(s.rows.splice(0, s.rows.length));
      s.inFlight = write;
      try {
        // eslint-disable-next-line no-await-in-loop
        written += await write;
      } finally {
        s.inFlight = null;
      }
    }
  }
  return written;
}

function scheduleFlush(s: BufferState): void {
  if (s.timer != null || s.rows.length === 0) return;
  s.timer = setTimeout(() => {
    s.timer = null;
    flushQueued(s).catch(() => undefined);
  }, SERVER_FLUSH_INTERVAL_MS);
  s.timer.unref?.();
}

function push(s: BufferState, row: AnalyticsEventRow): void {
  if (s.rows.length >= MAX_BUFFERED_EVENTS) {
    if (!s.dropping) {
      console.warn(
        `[analytics] buffer full (${MAX_BUFFERED_EVENTS} events), dropping new events`,
      );
    }
    s.dropping = true;
    return;
  }
  s.dropping = false;
  s.rows.push(row);
  // A flush already running takes whatever queued meanwhile before it ends,
  // so only start one when idle.
  if (s.rows.length >= SERVER_FLUSH_AT_EVENTS && s.inFlight == null) {
    flushQueued(s).catch(() => undefined);
  } else {
    scheduleFlush(s);
  }
}

/** Queues one row for the next batched insert. Never throws, never awaits. */
export function enqueueAnalyticsEvent(row: AnalyticsEventRow): void {
  push(state(), row);
}

function release(s: BufferState, key: string): void {
  const held = s.held.get(key);
  if (held == null) return;
  clearTimeout(held.timer);
  s.held.delete(key);
  push(s, held.row);
}

/**
 * Holds a row under `key` for `quietMs` before queuing it; another row under
 * the same key replaces it and restarts the wait. Search-as-you-type uses this
 * so "sam", "sams", "samsung" end up as one `search` event, not three.
 * `flushAnalyticsBuffer()` releases everything held.
 */
export function holdAnalyticsEvent(
  key: string,
  row: AnalyticsEventRow,
  quietMs: number,
): void {
  const s = state();
  const previous = s.held.get(key);
  if (previous != null) {
    clearTimeout(previous.timer);
    s.held.delete(key);
  } else if (s.held.size >= MAX_BUFFERED_EVENTS) {
    release(s, s.held.keys().next().value as string);
  }
  const timer = setTimeout(() => release(s, key), quietMs);
  timer.unref?.();
  s.held.set(key, { row, timer });
}

/**
 * Registers tracking work that is still building its row, so
 * `flushAnalyticsBuffer()` waits for it. The promise must not reject.
 */
export function trackPendingAnalytics(work: Promise<unknown>): void {
  const { pending } = state();
  if (pending.size >= MAX_BUFFERED_EVENTS) return;
  pending.add(work);
  work.finally(() => pending.delete(work)).catch(() => undefined);
}

/**
 * Releases every held row, writes everything queued and resolves to the
 * number of rows this call wrote. A failed write is logged once and dropped;
 * this never rejects. For tests and shutdown: normal traffic is flushed by the
 * timer and the size threshold.
 */
export async function flushAnalyticsBuffer(): Promise<number> {
  const s = state();
  await Promise.allSettled(Array.from(s.pending));
  Array.from(s.held.keys()).forEach((key) => release(s, key));
  return flushQueued(s);
}

/** Rows queued or held right now (for tests and diagnostics). */
export function bufferedAnalyticsEventCount(): number {
  const s = state();
  return s.rows.length + s.held.size;
}

/** Drops everything queued or held without writing it. Tests only. */
export function resetAnalyticsBuffer(): void {
  const s = state();
  if (s.timer != null) clearTimeout(s.timer);
  s.held.forEach(({ timer }) => clearTimeout(timer));
  s.pending.clear();
  globalForAnalytics.analyticsBuffer = undefined;
}
