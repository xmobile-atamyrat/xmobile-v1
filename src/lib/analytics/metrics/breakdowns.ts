import { Prisma } from '@prisma/client';

import {
  plainRows,
  rawVisitorsByPlatform,
  storedOnlyTo,
  sumDailyBy,
} from './sql';
import {
  DIM,
  eventsWhere,
  insertDaily,
  NORMALISED_REFERRER_SQL,
  STORED,
  type DailyRollup,
} from './stored';
import type { WidgetGroup } from './widget';

/**
 * Breakdowns. `key` (and `label`) is the raw value; the dashboard translates.
 * - by_platform: unique visitors per platform ('WEB' / 'APP'). Exact inside
 *   the raw window. A range reaching past it adds the exact count of its days
 *   inside the window to the sum of daily uniques before it (an upper bound).
 *   A visitor who used both counts in both.
 * - by_locale: page views per locale code.
 * - by_device: page views per device ('mobile' / 'tablet' / 'desktop', or
 *   'unknown' when the tracker sent none).
 * - top_referrers: page views that arrived from an external referrer, per
 *   host (lower-cased, leading 'www.' dropped).
 */

export const breakdownsRollups: DailyRollup[] = [
  {
    metrics: [STORED.referrers],
    reads: ['events'],
    build: (day) => [
      insertDaily(
        day,
        STORED.referrers,
        Prisma.sql`
          SELECT ${DIM.host} AS dimension, host AS dimension_value, count(*)::bigint AS value
          FROM (
            SELECT ${NORMALISED_REFERRER_SQL} AS host
            FROM "AnalyticsEvent"
            WHERE ${eventsWhere(day, day, ['page_view'])}
          ) AS r
          WHERE host IS NOT NULL AND host <> ''
          GROUP BY host`,
      ),
    ],
  },
];

export const breakdownsWidgets = {
  by_platform: async ({ from, to, limit, ctx }) => {
    if (from >= ctx.rawFrom) {
      const rows = await rawVisitorsByPlatform(from, to);
      return { kind: 'topN', rows: plainRows(rows.slice(0, limit)) };
    }
    const [old, recent] = await Promise.all([
      sumDailyBy(STORED.visitors, DIM.platform, from, storedOnlyTo(to, ctx)),
      to >= ctx.rawFrom ? rawVisitorsByPlatform(ctx.rawFrom, to) : [],
    ]);
    const totals = new Map<string, number>();
    [...old, ...recent].forEach(({ key, value }) =>
      totals.set(key, (totals.get(key) ?? 0) + value),
    );
    const rows = Array.from(totals, ([key, value]) => ({ key, value })).sort(
      (a, b) => b.value - a.value || (a.key < b.key ? -1 : 1),
    );
    return { kind: 'topN', rows: plainRows(rows.slice(0, limit)) };
  },
  by_locale: async ({ from, to, limit }) => ({
    kind: 'topN',
    rows: plainRows(
      await sumDailyBy(STORED.pageviews, DIM.locale, from, to, limit),
    ),
  }),
  by_device: async ({ from, to, limit }) => ({
    kind: 'topN',
    rows: plainRows(
      await sumDailyBy(STORED.pageviews, DIM.device, from, to, limit),
    ),
  }),
  top_referrers: async ({ from, to, limit }) => ({
    kind: 'topN',
    rows: plainRows(
      await sumDailyBy(STORED.referrers, DIM.host, from, to, limit),
    ),
  }),
} satisfies WidgetGroup;
