import { z } from 'zod';

import { ANALYTICS_LOCALES, DEFAULT_ANALYTICS_LOCALE } from './constants';
import { WIDGETS, type MetricId } from './metrics/catalog';
import type { Granularity } from './metrics/types';

/**
 * Query handling for `GET /api/admin/analytics`, shared by the API route and
 * the /admin/analytics dashboard. Pure: no Prisma, no Node APIs, so the
 * dashboard can import it.
 *
 * Days are Asia/Ashgabat calendar days as 'YYYY-MM-DD'.
 */

export const ANALYTICS_TIME_ZONE = 'Asia/Ashgabat';
/** Default range: the last 30 days, today included. */
export const DEFAULT_RANGE_DAYS = 30;
/** Longest range the API answers, in days (about two years). */
export const MAX_RANGE_DAYS = 731;
export const DEFAULT_TOP_LIMIT = 10;
export const MAX_TOP_LIMIT = 50;
export const GRANULARITIES = ['day', 'week', 'month'] as const;
/**
 * Earliest day the API answers. Nothing was tracked before it, and without a
 * floor a typo like 0001-01-01 reaches Postgres as a negative year.
 */
export const MIN_ANALYTICS_DAY = '2020-01-01';

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
const DAY_MS = 86_400_000;

export const isValidDay = (value: string): boolean => {
  if (!DAY_RE.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value);
};

export function shiftDay(day: string, days: number): string {
  const date = new Date(`${day}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/** Number of days in `from`..`to`, both included. */
export const rangeDays = (from: string, to: string): number =>
  Math.round(
    (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY_MS,
  ) + 1;

/** Calendar day of an instant in the shop's time zone. */
export function ashgabatDay(date: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: ANALYTICS_TIME_ZONE,
  }).format(date);
}

/**
 * Latest `to` the API answers: tomorrow in Ashgabat, so a browser whose clock
 * is slightly ahead still gets an answer.
 */
export const maxAnalyticsDay = (now: Date = new Date()): string =>
  shiftDay(ashgabatDay(now), 1);

/**
 * First day of the chart period (day, ISO week from Monday, or calendar
 * month) that contains `day`.
 */
export function periodStartOf(day: string, granularity: Granularity): string {
  if (granularity === 'month') return `${day.slice(0, 7)}-01`;
  if (granularity === 'week') {
    const date = new Date(`${day}T00:00:00Z`);
    date.setUTCDate(date.getUTCDate() - ((date.getUTCDay() + 6) % 7));
    return date.toISOString().slice(0, 10);
  }
  return day;
}

/**
 * The range the dashboard requests for week and month charts: `from` moves
 * back to the start of its period, so the first point is a whole week or
 * month rather than its last few days. When that would make the range longer
 * than the API allows (or earlier than MIN_ANALYTICS_DAY), `from` moves
 * forward to the next period start instead.
 */
export function alignRangeToPeriods(
  range: { from: string; to: string },
  granularity: Granularity,
): { from: string; to: string } {
  if (granularity === 'day') return range;
  const start = periodStartOf(range.from, granularity);
  if (start === range.from) return range;
  if (
    start >= MIN_ANALYTICS_DAY &&
    rangeDays(start, range.to) <= MAX_RANGE_DAYS
  ) {
    return { from: start, to: range.to };
  }
  const next =
    granularity === 'week'
      ? shiftDay(start, 7)
      : periodStartOf(shiftDay(start, 31), 'month');
  return next <= range.to ? { from: next, to: range.to } : range;
}

const WIDGET_IDS = new Set<string>(WIDGETS.map((widget) => widget.id));

/** The widgets a viewer may see, in catalog order. */
export function visibleWidgetIds(superuser: boolean): MetricId[] {
  return WIDGETS.filter((widget) => superuser || widget.access === 'staff').map(
    (widget) => widget.id,
  );
}

const daySchema = z.string().refine(isValidDay, 'Expected YYYY-MM-DD');

const querySchema = z.object({
  widgets: z
    .string()
    .max(2000)
    .optional()
    .transform((value) =>
      (value ?? '')
        .split(',')
        .map((id) => id.trim())
        .filter(Boolean),
    )
    .refine((ids) => ids.every((id) => WIDGET_IDS.has(id)), {
      message: 'Unknown widget id',
    }),
  from: daySchema.optional(),
  to: daySchema.optional(),
  granularity: z.enum(GRANULARITIES).default('day'),
  limit: z.coerce
    .number()
    .int()
    .min(1)
    .max(MAX_TOP_LIMIT)
    .default(DEFAULT_TOP_LIMIT),
  // Only picks the language of product/category names; never worth a 400.
  locale: z.enum(ANALYTICS_LOCALES).catch(DEFAULT_ANALYTICS_LOCALE),
});

export type AnalyticsQuery = {
  /** Requested and allowed, deduplicated, in catalog order. */
  widgets: MetricId[];
  from: string;
  to: string;
  granularity: Granularity;
  limit: number;
  locale: string;
};

type RawQuery = Record<string, string | string[] | undefined>;

const first = (value: string | string[] | undefined): string | undefined => {
  const single = Array.isArray(value) ? value[0] : value;
  return single === '' ? undefined : single;
};

/**
 * Validates and fills in the query. Widgets the viewer may not see are left
 * out silently (an ADMIN asking for a superuser widget just doesn't get it);
 * unknown ids, bad days, days before MIN_ANALYTICS_DAY or after tomorrow,
 * `from` after `to` and ranges over two years are errors.
 */
export function parseAnalyticsQuery(
  query: RawQuery,
  { superuser, now = new Date() }: { superuser: boolean; now?: Date },
): { ok: true; value: AnalyticsQuery } | { ok: false; message: string } {
  const parsed = querySchema.safeParse({
    widgets: first(query.widgets),
    from: first(query.from),
    to: first(query.to),
    granularity: first(query.granularity),
    limit: first(query.limit),
    locale: first(query.locale),
  });
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return {
      ok: false,
      message: `Invalid ${issue.path.join('.') || 'query'}: ${issue.message}`,
    };
  }
  const { data } = parsed;

  const to = data.to ?? ashgabatDay(now);
  const from = data.from ?? shiftDay(to, -(DEFAULT_RANGE_DAYS - 1));
  if (to < MIN_ANALYTICS_DAY) {
    return {
      ok: false,
      message: `Invalid to: must not be before ${MIN_ANALYTICS_DAY}`,
    };
  }
  if (from < MIN_ANALYTICS_DAY) {
    return {
      ok: false,
      message: `Invalid from: must not be before ${MIN_ANALYTICS_DAY}`,
    };
  }
  const latest = maxAnalyticsDay(now);
  if (to > latest) {
    return { ok: false, message: `Invalid to: must not be after ${latest}` };
  }
  if (from > to) {
    return { ok: false, message: 'Invalid range: from is after to' };
  }
  if (rangeDays(from, to) > MAX_RANGE_DAYS) {
    return {
      ok: false,
      message: `Invalid range: at most ${MAX_RANGE_DAYS} days`,
    };
  }

  const allowed = visibleWidgetIds(superuser);
  const requested = new Set(data.widgets);
  const widgets =
    requested.size === 0 ? allowed : allowed.filter((id) => requested.has(id));

  return {
    ok: true,
    value: {
      widgets,
      from,
      to,
      granularity: data.granularity,
      limit: data.limit,
      locale: data.locale,
    },
  };
}

/** Range presets offered by the dashboard. */
export const RANGE_PRESETS = ['7d', '30d', '90d', '12m'] as const;
export type RangePreset = (typeof RANGE_PRESETS)[number];

const PRESET_DAYS: Record<RangePreset, number> = {
  '7d': 7,
  '30d': 30,
  '90d': 90,
  '12m': 365,
};

/** The days a preset covers, ending today (inclusive). */
export function presetRange(
  preset: RangePreset,
  today: string,
): { from: string; to: string } {
  return { from: shiftDay(today, -(PRESET_DAYS[preset] - 1)), to: today };
}

/** The dashboard's request path for a range and granularity. */
export function analyticsRequestPath(params: {
  from: string;
  to: string;
  granularity: Granularity;
  locale?: string;
  limit?: number;
  widgets?: readonly string[];
}): string {
  const search = new URLSearchParams();
  if (params.widgets && params.widgets.length > 0) {
    search.set('widgets', params.widgets.join(','));
  }
  search.set('from', params.from);
  search.set('to', params.to);
  search.set('granularity', params.granularity);
  if (params.limit != null) search.set('limit', String(params.limit));
  if (params.locale) search.set('locale', params.locale);
  return `/api/admin/analytics?${search.toString()}`;
}
