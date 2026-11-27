import { Prisma } from '@prisma/client';

import { plainRows, sumDailyBy } from './sql';
import {
  DIM,
  eventsWhere,
  insertDaily,
  NORMALISED_QUERY_SQL,
  STORED,
  type DailyRollup,
  type StoredMetric,
} from './stored';
import type { WidgetGroup } from './widget';

/**
 * Searches, grouped on the normalised query (trimmed, whitespace collapsed,
 * lower-cased; empty queries are skipped). A zero-result search is one whose
 * `results` prop is 0. Widgets: top_searches, zero_result_searches.
 */

const searchRollup = (
  metric: StoredMetric,
  zeroResultsOnly: boolean,
): DailyRollup => ({
  metrics: [metric],
  reads: ['events'],
  build: (day) => [
    insertDaily(
      day,
      metric,
      Prisma.sql`
        SELECT ${DIM.query} AS dimension, q AS dimension_value, count(*)::bigint AS value
        FROM (
          SELECT ${NORMALISED_QUERY_SQL} AS q
          FROM "AnalyticsEvent"
          WHERE ${eventsWhere(day, day, ['search'])}
          ${
            zeroResultsOnly
              ? Prisma.sql`AND jsonb_typeof("props"->'results') = 'number'
                           AND ("props"->>'results')::numeric = 0`
              : Prisma.empty
          }
        ) AS s
        WHERE q IS NOT NULL AND q <> ''
        GROUP BY q`,
    ),
  ],
});

export const searchRollups: DailyRollup[] = [
  searchRollup(STORED.searches, false),
  searchRollup(STORED.zeroResultSearches, true),
];

export const searchWidgets = {
  top_searches: async ({ from, to, limit }) => ({
    kind: 'topN',
    rows: plainRows(
      await sumDailyBy(STORED.searches, DIM.query, from, to, limit),
    ),
  }),
  zero_result_searches: async ({ from, to, limit }) => ({
    kind: 'topN',
    rows: plainRows(
      await sumDailyBy(STORED.zeroResultSearches, DIM.query, from, to, limit),
    ),
  }),
} satisfies WidgetGroup;
