import type { MetricAccess, MetricKind, MetricUnit } from './types';

/**
 * Every dashboard widget, in display order. This is the shared contract:
 * - src/lib/analytics/metrics implements a `query` for each id,
 * - the admin API filters by `access`,
 * - the dashboard lays widgets out by `kind` and labels them with `labelKey`
 *   (a flat key that must exist in all five src/i18n/<locale>.json files).
 *
 * Revenue widgets are `superuser`; everything else is `staff`
 * (ADMIN + SUPERUSER).
 */
export const WIDGETS = [
  // KPI row
  {
    id: 'kpi_visitors',
    kind: 'kpi',
    access: 'staff',
    unit: 'count',
    labelKey: 'analyticsVisitors',
  },
  {
    id: 'kpi_sessions',
    kind: 'kpi',
    access: 'staff',
    unit: 'count',
    labelKey: 'analyticsSessions',
  },
  {
    id: 'kpi_pageviews',
    kind: 'kpi',
    access: 'staff',
    unit: 'count',
    labelKey: 'analyticsPageviews',
  },
  {
    id: 'kpi_orders_placed',
    kind: 'kpi',
    access: 'staff',
    unit: 'count',
    labelKey: 'analyticsOrdersPlaced',
  },
  {
    id: 'kpi_conversion',
    kind: 'kpi',
    access: 'staff',
    unit: 'percent',
    labelKey: 'analyticsConversionRate',
  },
  {
    id: 'kpi_revenue',
    kind: 'kpi',
    access: 'superuser',
    unit: 'tmt',
    labelKey: 'analyticsRevenue',
  },
  {
    id: 'kpi_orders_completed',
    kind: 'kpi',
    access: 'superuser',
    unit: 'count',
    labelKey: 'analyticsOrdersCompleted',
  },
  {
    id: 'kpi_aov',
    kind: 'kpi',
    access: 'superuser',
    unit: 'tmt',
    labelKey: 'analyticsAverageOrderValue',
  },

  // Charts
  {
    id: 'traffic',
    kind: 'timeseries',
    access: 'staff',
    unit: 'count',
    labelKey: 'analyticsTraffic',
  },
  {
    id: 'revenue',
    kind: 'timeseries',
    access: 'superuser',
    unit: 'tmt',
    labelKey: 'analyticsRevenueOverTime',
  },
  {
    id: 'funnel',
    kind: 'funnel',
    access: 'staff',
    unit: 'count',
    labelKey: 'analyticsFunnel',
  },

  // Top lists
  {
    id: 'top_products',
    kind: 'topN',
    access: 'staff',
    unit: 'count',
    labelKey: 'analyticsTopProducts',
  },
  {
    id: 'top_categories',
    kind: 'topN',
    access: 'staff',
    unit: 'count',
    labelKey: 'analyticsTopCategories',
  },
  {
    id: 'top_searches',
    kind: 'topN',
    access: 'staff',
    unit: 'count',
    labelKey: 'analyticsTopSearches',
  },
  {
    id: 'zero_result_searches',
    kind: 'topN',
    access: 'staff',
    unit: 'count',
    labelKey: 'analyticsZeroResultSearches',
  },
  {
    id: 'top_cart_adds',
    kind: 'topN',
    access: 'staff',
    unit: 'count',
    labelKey: 'analyticsTopCartAdds',
  },

  // Breakdowns (topN over a dimension)
  {
    id: 'by_platform',
    kind: 'topN',
    access: 'staff',
    unit: 'count',
    labelKey: 'analyticsByPlatform',
  },
  {
    id: 'by_locale',
    kind: 'topN',
    access: 'staff',
    unit: 'count',
    labelKey: 'analyticsByLocale',
  },
  {
    id: 'by_device',
    kind: 'topN',
    access: 'staff',
    unit: 'count',
    labelKey: 'analyticsByDevice',
  },
  {
    id: 'top_referrers',
    kind: 'topN',
    access: 'staff',
    unit: 'count',
    labelKey: 'analyticsTopReferrers',
  },
] as const satisfies readonly {
  id: string;
  kind: MetricKind;
  access: MetricAccess;
  unit: MetricUnit;
  labelKey: string;
}[];

export type WidgetMeta = (typeof WIDGETS)[number];
/** A dashboard widget id. Also the `metric` prefix used in AnalyticsDaily. */
export type MetricId = WidgetMeta['id'];

/**
 * Label keys used inside widget data (timeseries `series[].labelKey`, funnel
 * `steps[].labelKey`). They also need entries in all five locale files.
 */
export const SERIES_LABEL_KEYS = {
  visitors: 'analyticsVisitors',
  sessions: 'analyticsSessions',
  pageviews: 'analyticsPageviews',
  pageviewsWeb: 'analyticsPageviewsWeb',
  pageviewsApp: 'analyticsPageviewsApp',
  revenue: 'analyticsRevenue',
  ordersCompleted: 'analyticsOrdersCompleted',
  funnelProductView: 'analyticsFunnelProductView',
  funnelCartAdd: 'analyticsFunnelCartAdd',
  funnelOrderPlaced: 'analyticsFunnelOrderPlaced',
  funnelOrderCompleted: 'analyticsFunnelOrderCompleted',
} as const;

export const widgetMeta = (id: string): WidgetMeta | undefined =>
  WIDGETS.find((w) => w.id === id);
