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
 * unknown ids, bad days, `from` after `to` and ranges over two years are
 * errors.
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
