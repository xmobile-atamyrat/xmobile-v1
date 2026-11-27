import { currentGrade } from '@/pages/api/utils/authMiddleware';
import { isStaff } from '@/pages/api/utils/staffAuth';

/**
 * Staff (ADMIN / SUPERUSER) browsing the shop isn't customer traffic, so no
 * analytics event is recorded for them. The grade is read from the database
 * (like `withAuth`, so a promotion or demotion sticks) and cached here for a
 * few minutes: a beacon or cart add shouldn't cost a user lookup every time.
 */

/** How long a looked-up grade is trusted. */
export const STAFF_GRADE_TTL_MS = 5 * 60 * 1000;
/** Users remembered at once; the oldest entry is evicted beyond this. */
export const STAFF_GRADE_MAX_KEYS = 5_000;

interface CacheEntry {
  expiresAt: number;
  /** Set once the lookup has resolved. */
  staff?: boolean;
  lookup: Promise<boolean>;
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
 * The cached answer for `userId`, or undefined when it isn't known yet (or
 * has expired). Lets callers skip a promise on the hot path.
 */
export function cachedIsStaffUser(userId: string): boolean | undefined {
  const entry = cache().get(userId);
  if (entry == null || entry.expiresAt <= Date.now()) return undefined;
  return entry.staff;
}

/**
 * Whether `userId` is currently staff. Never rejects: a failed lookup counts
 * as "not staff" (and isn't cached), so analytics keeps recording.
 */
export function isStaffUser(userId: string): Promise<boolean> {
  const entries = cache();
  const now = Date.now();
  const existing = entries.get(userId);
  if (existing != null && existing.expiresAt > now) return existing.lookup;

  const entry: CacheEntry = {
    expiresAt: now + STAFF_GRADE_TTL_MS,
    lookup: Promise.resolve(false),
  };
  entry.lookup = currentGrade(userId)
    .then((grade) => {
      entry.staff = isStaff(grade ?? undefined);
      return entry.staff;
    })
    .catch((error) => {
      if (entries.get(userId) === entry) entries.delete(userId);
      console.warn('[analytics] staff lookup failed:', error);
      return false;
    });
  // Re-inserted so the Map stays oldest-first and eviction takes the front.
  entries.delete(userId);
  entries.set(userId, entry);
  while (entries.size > STAFF_GRADE_MAX_KEYS) {
    entries.delete(entries.keys().next().value as string);
  }
  return entry.lookup;
}

/** Forgets every cached grade. Tests only. */
export function resetStaffGradeCache(): void {
  globalForStaff.analyticsStaffGrades = undefined;
}
