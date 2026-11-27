import { ashgabatDay } from '@/lib/analytics/adminQuery';
import { useEffect, useState } from 'react';

const DAY_MS = 86_400_000;
/** Asia/Ashgabat is UTC+05:00 all year (no DST). */
const ASHGABAT_OFFSET_MS = 5 * 60 * 60 * 1000;
/** Fire a moment after midnight, so the new day has surely begun. */
const AFTER_MIDNIGHT_MS = 1_000;

/** Milliseconds from `now` until just after the next Ashgabat midnight. */
export const msUntilAshgabatMidnight = (now: number): number =>
  DAY_MS - ((now + ASHGABAT_OFFSET_MS) % DAY_MS) + AFTER_MIDNIGHT_MS;

/**
 * Today in Ashgabat, kept current while the page stays open: one timer for
 * the next midnight, and a re-check whenever the tab regains focus or becomes
 * visible again (a sleeping laptop's timers don't fire on time). A fixed
 * `override` (tests) is returned as is.
 */
export function useAshgabatToday(override?: string): string {
  const [today, setToday] = useState(() => override ?? ashgabatDay());

  useEffect(() => {
    if (override != null) return undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const refresh = () => {
      // Same string, same state: React skips the re-render.
      setToday(ashgabatDay());
      clearTimeout(timer);
      timer = setTimeout(refresh, msUntilAshgabatMidnight(Date.now()));
    };
    const onVisibility = () => {
      if (document.visibilityState === 'visible') refresh();
    };
    refresh();
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [override]);

  return override ?? today;
}
