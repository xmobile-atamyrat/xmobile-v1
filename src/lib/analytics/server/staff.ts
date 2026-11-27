import dbClient from '@/lib/dbClient';
import { isStaff } from '@/pages/api/utils/staffAuth';

/**
 * What analytics needs to know about a logged-in user, read from the database
 * (like `withAuth`, so a promotion, demotion or account deletion sticks) and
 * cached here for a few minutes: a beacon or cart add shouldn't cost a user
 * lookup every time.
 *
 * - Staff (ADMIN / SUPERUSER) browsing the shop isn't customer traffic, so no
 *   event is recorded for them.
 * - A soft-deleted account (`deletedAt` set), or one that no longer exists,
 *   isn't attached to new events: they are recorded anonymously.
 */

/** How long a looked-up user is trusted. */
export const STAFF_GRADE_TTL_MS = 5 * 60 * 1000;
/** Users remembered at once; the oldest entry is evicted beyond this. */
export const STAFF_GRADE_MAX_KEYS = 5_000;

export interface AnalyticsUserStatus {
  /** ADMIN or SUPERUSER: drop the event. */
  staff: boolean;
  /** Soft-deleted or gone: record the event without the userId. */
  deleted: boolean;
}

const UNKNOWN: AnalyticsUserStatus = { staff: false, deleted: false };

interface CacheEntry {
  expiresAt: number;
  /** Set once the lookup has resolved. */
  status?: AnalyticsUserStatus;
  lookup: Promise<AnalyticsUserStatus>;
}

const globalForStaff = globalThis as typeof globalThis & {
  analyticsStaffGrades?: Map<string, CacheEntry>;
};

function cache(): Map<string, CacheEntry> {
  if (globalForStaff.analyticsStaffGrades == null) {
    globalForStaff.analyticsStaffGrades = new Map();
  }
  return globalForStaff.analyticsStaffGrades;
}

/**
 * The cached status of `userId`, or undefined when it isn't known yet (or has
 * expired). Lets callers skip a promise on the hot path.
 */
export function cachedAnalyticsUser(
  userId: string,
): AnalyticsUserStatus | undefined {
  const entry = cache().get(userId);
  if (entry == null || entry.expiresAt <= Date.now()) return undefined;
  return entry.status;
}

/**
 * Whether `userId` is staff and whether the account is deleted, in one
 * lookup. Never rejects: a failed lookup counts as "neither" (and isn't
 * cached), so analytics keeps recording.
 */
export function lookupAnalyticsUser(
  userId: string,
): Promise<AnalyticsUserStatus> {
  const entries = cache();
  const now = Date.now();
  const existing = entries.get(userId);
  if (existing != null && existing.expiresAt > now) return existing.lookup;

  const entry: CacheEntry = {
    expiresAt: now + STAFF_GRADE_TTL_MS,
    lookup: Promise.resolve(UNKNOWN),
  };
  entry.lookup = dbClient.user
    .findUnique({
      where: { id: userId },
      select: { grade: true, deletedAt: true },
    })
    .then((user) => {
      entry.status =
        user == null
          ? { staff: false, deleted: true }
          : {
              staff: user.deletedAt == null && isStaff(user.grade),
              deleted: user.deletedAt != null,
            };
      return entry.status;
    })
    .catch((error) => {
      if (entries.get(userId) === entry) entries.delete(userId);
      console.warn('[analytics] user lookup failed:', error);
      return UNKNOWN;
    });
  // Re-inserted so the Map stays oldest-first and eviction takes the front.
  entries.delete(userId);
  entries.set(userId, entry);
  while (entries.size > STAFF_GRADE_MAX_KEYS) {
    entries.delete(entries.keys().next().value as string);
  }
  return entry.lookup;
}

/** Whether `userId` is currently staff (see `lookupAnalyticsUser`). */
export async function isStaffUser(userId: string): Promise<boolean> {
  return (await lookupAnalyticsUser(userId)).staff;
}

/** Forgets every cached user. Tests only. */
export function resetStaffGradeCache(): void {
  globalForStaff.analyticsStaffGrades = undefined;
}
