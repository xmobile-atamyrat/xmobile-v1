/**
 * Guards for `seed-analytics.ts`, kept pure so they can be unit-tested.
 *
 * The DATABASE_URL host check (args.ts) can't tell production apart: Postgres
 * runs on the same VM as the app, so production's URL says localhost too.
 * These checks look at the environment and at what the database holds
 * instead, and the seed marker records which rollup days a seed run owns, so
 * re-seeding and --clean only ever rebuild those.
 */
import { addDays, monthStart, weekStart } from './generate';

export interface DayRange {
  from: string;
  to: string;
}

/**
 * `AnalyticsDaily.metric` of the marker row: `day` is the first day the seed
 * owns and `dimensionValue` the last. No metric query or rollup reads or
 * deletes metrics it doesn't know by name, so the row is inert outside this
 * script.
 */
export const SEED_MARKER_METRIC = 'seed_marker';
export const SEED_MARKER_DIMENSION = 'seeded_to';

/**
 * Non-seed raw events older than a day that a dev database may have from
 * clicking around. More than this looks like real traffic.
 */
export const MAX_FOREIGN_EVENTS = 50;

const REFUSED_APP_ENVS = new Set(['production', 'staging']);

/** Refusal reason when NEXT_PUBLIC_APP_ENV names a deployed environment. */
export function checkAppEnv(appEnv: string | undefined): string | null {
  const value = (appEnv ?? '').trim().toLowerCase();
  if (!REFUSED_APP_ENVS.has(value)) return null;
  return `NEXT_PUBLIC_APP_ENV is "${value}": this is a deployed environment, and seeding would mix fake traffic and orders into its analytics.`;
}

/**
 * The days a seed run starting on `firstDay` owns: from the start of the
 * week or month containing `firstDay` (their unique-visitor rows include
 * seed visitors) to `today`.
 */
export function seedRange(firstDay: string, today: string): DayRange {
  const weekFrom = weekStart(firstDay);
  const monthFrom = monthStart(firstDay);
  return { from: weekFrom < monthFrom ? weekFrom : monthFrom, to: today };
}

/** The smallest range covering every given one, or null for none. */
export function unionRanges(
  ...ranges: (DayRange | null | undefined)[]
): DayRange | null {
  const present = ranges.filter((r): r is DayRange => r != null);
  if (present.length === 0) return null;
  return {
    from: present.map((r) => r.from).sort()[0],
    to: present
      .map((r) => r.to)
      .sort()
      .at(-1)!,
  };
}

/** The parts of `range` outside `exclude` (zero, one or two ranges). */
export function rangesOutside(range: DayRange, exclude: DayRange): DayRange[] {
  if (exclude.to < range.from || exclude.from > range.to) return [range];
  const out: DayRange[] = [];
  if (range.from < exclude.from) {
    out.push({ from: range.from, to: addDays(exclude.from, -1) });
  }
  if (range.to > exclude.to) {
    out.push({ from: addDays(exclude.to, 1), to: range.to });
  }
  return out;
}

export interface HistoryFacts {
  /**
   * Days older than the raw window, inside the range the run would rebuild
   * but outside the earlier seed's, with non-zero event-based rollups. Their
   * raw events are gone, so a rebuild would replace them with seed numbers.
   */
  foreignRollupDays: string[];
  /** Non-seed raw events older than a day (counted up to a cap). */
  foreignEvents: number;
}

const describeDays = (days: string[]): string =>
  days.length === 1
    ? days[0]
    : `${days.length} days between ${days[0]} and ${days.at(-1)}`;

/** Why the database looks like it holds real history, if it does. */
export function historyRefusals(facts: HistoryFacts): string[] {
  const reasons: string[] = [];
  if (facts.foreignRollupDays.length > 0) {
    reasons.push(
      `AnalyticsDaily has rollups for ${describeDays(facts.foreignRollupDays)} that no seed run recorded (no ${SEED_MARKER_METRIC} row covers them) and whose raw events are already pruned. Seeding would overwrite them for good. If they come from a seed run made before the marker existed, --force is safe.`,
    );
  }
  if (facts.foreignEvents > MAX_FOREIGN_EVENTS) {
    reasons.push(
      `AnalyticsEvent holds more than ${MAX_FOREIGN_EVENTS} non-seed events older than a day, which looks like real traffic.`,
    );
  }
  return reasons;
}

/** The marker rows' range (several rows are merged), or null. */
export function parseMarker(
  rows: { day: Date | string; to: string }[],
): DayRange | null {
  const ranges = rows
    .map((row) => ({
      from:
        typeof row.day === 'string'
          ? row.day.slice(0, 10)
          : row.day.toISOString().slice(0, 10),
      to: row.to,
    }))
    .filter((r) => /^\d{4}-\d{2}-\d{2}$/.test(r.to) && r.from <= r.to);
  return unionRanges(...ranges);
}
