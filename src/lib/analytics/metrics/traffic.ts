import { Prisma } from '@prisma/client';

import { periodEnd, periodStarts } from '../time';
import { SERIES_LABEL_KEYS } from './catalog';
import {
  clipPeriod,
  eventSumUntil,
  isFinalPeriod,
  periodRows,
  sessionCount,
  storedOnlyTo,
  sumDailyByPeriod,
  toPoints,
  uniqueVisitors,
  type QueryContext,
} from './sql';
import {
  DIM,
  eventsWhere,
  insertDaily,
  STORED,
  UNKNOWN_DEVICE,
  type DailyRollup,
} from './stored';
import type { Granularity } from './types';
import { kpi, type WidgetGroup } from './widget';

/**
 * Traffic: page views, unique visitors and sessions.
 * Widgets: kpi_visitors, kpi_sessions, kpi_pageviews, traffic.
 */

export const trafficRollups: DailyRollup[] = [
  {
    metrics: [STORED.pageviews],
    reads: ['events'],
    build: (day) => {
      const where = eventsWhere(day, day, ['page_view']);
      return [
        insertDaily(
          day,
          STORED.pageviews,
          Prisma.sql`
            SELECT ${DIM.total} AS dimension, '' AS dimension_value, count(*)::bigint AS value
            FROM "AnalyticsEvent" WHERE ${where}
            UNION ALL
            SELECT ${DIM.platform}, "platform"::text, count(*)::bigint
            FROM "AnalyticsEvent" WHERE ${where} GROUP BY 2
            UNION ALL
            SELECT ${DIM.locale}, "locale"::text, count(*)::bigint
            FROM "AnalyticsEvent" WHERE ${where} GROUP BY 2
            UNION ALL
            SELECT ${DIM.device}, COALESCE(NULLIF("props"->>'device', ''), ${UNKNOWN_DEVICE}), count(*)::bigint
            FROM "AnalyticsEvent" WHERE ${where} GROUP BY 2`,
        ),
      ];
    },
  },
  {
    metrics: [STORED.visitors, STORED.sessions],
    reads: ['events'],
    build: (day) => {
      const where = eventsWhere(day, day);
      return [
        insertDaily(
          day,
          STORED.visitors,
          Prisma.sql`
            SELECT ${DIM.total} AS dimension, '' AS dimension_value,
                   count(DISTINCT "visitorId")::bigint AS value
            FROM "AnalyticsEvent" WHERE ${where}
            UNION ALL
            SELECT ${DIM.platform}, "platform"::text, count(DISTINCT "visitorId")::bigint
            FROM "AnalyticsEvent" WHERE ${where} GROUP BY 2`,
        ),
        insertDaily(
          day,
          STORED.sessions,
          Prisma.sql`
            SELECT ${DIM.total} AS dimension, '' AS dimension_value,
                   count(DISTINCT "sessionId")::bigint AS value
            FROM "AnalyticsEvent" WHERE ${where}`,
        ),
      ];
    },
  },
];

/**
 * Unique visitors per day/week/month period, clipped to `from`..`to`:
 * - day: the daily `visitors` rows;
 * - a whole week/month with a final stored row: that row;
 * - otherwise uniqueVisitors over the clipped period: exact inside the raw
 *   window, and for a period reaching past it, exact for its days inside the
 *   window plus the tightest stored upper bound for the days before.
 */
export async function visitorsByPeriod(
  from: string,
  to: string,
  granularity: Granularity,
  ctx: QueryContext,
): Promise<Map<string, number>> {
  if (granularity === 'day') {
    return sumDailyByPeriod(STORED.visitors, from, to, 'day');
  }
  const metric =
    granularity === 'week' ? STORED.visitorsWeek : STORED.visitorsMonth;
  const starts = periodStarts(from, to, granularity);
  const stored = await periodRows(metric, starts);
  const preload =
    from < ctx.rawFrom ? { from, to: storedOnlyTo(to, ctx) } : undefined;

  const values = await Promise.all(
    starts.map(async (start): Promise<[string, number]> => {
      const clip = clipPeriod(start, granularity, from, to);
      const whole =
        clip.from === start && clip.to === periodEnd(start, granularity);
      const row = stored.get(start);
      if (
        whole &&
        row !== undefined &&
        isFinalPeriod(start, granularity, ctx.today)
      ) {
        return [start, row];
      }
      return [start, (await uniqueVisitors(clip, ctx, preload)).value];
    }),
  );
  return new Map(values);
}

export const trafficWidgets = {
  kpi_visitors: (p) => kpi(p, (range) => uniqueVisitors(range, p.ctx)),

  kpi_sessions: (p) => kpi(p, (range) => sessionCount(range, p.ctx)),

  kpi_pageviews: (p) =>
    kpi(p, (range) =>
      eventSumUntil(p.ctx, STORED.pageviews, range, 'page_view'),
    ),

  traffic: async ({ from, to, granularity, ctx }) => {
    const [visitors, sessions, pageviews, web, app] = await Promise.all([
      visitorsByPeriod(from, to, granularity, ctx),
      sumDailyByPeriod(STORED.sessions, from, to, granularity),
      sumDailyByPeriod(STORED.pageviews, from, to, granularity),
      sumDailyByPeriod(
        STORED.pageviews,
        from,
        to,
        granularity,
        DIM.platform,
        'WEB',
      ),
      sumDailyByPeriod(
        STORED.pageviews,
        from,
        to,
        granularity,
        DIM.platform,
        'APP',
      ),
    ]);
    const points = (values: Map<string, number>) =>
      toPoints(values, from, to, granularity);
    return {
      kind: 'timeseries',
      series: [
        {
          key: 'visitors',
          labelKey: SERIES_LABEL_KEYS.visitors,
          points: points(visitors),
        },
        {
          key: 'sessions',
          labelKey: SERIES_LABEL_KEYS.sessions,
          points: points(sessions),
        },
        {
          key: 'pageviews',
          labelKey: SERIES_LABEL_KEYS.pageviews,
          points: points(pageviews),
        },
        {
          key: 'pageviews_web',
          labelKey: SERIES_LABEL_KEYS.pageviewsWeb,
          points: points(web),
        },
        {
          key: 'pageviews_app',
          labelKey: SERIES_LABEL_KEYS.pageviewsApp,
          points: points(app),
        },
      ],
    };
  },
} satisfies WidgetGroup;
