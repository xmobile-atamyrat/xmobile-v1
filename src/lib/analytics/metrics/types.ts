/**
 * Contracts between the rollup/metric code (src/lib/analytics/metrics), the
 * admin API (GET /api/admin/analytics) and the dashboard (/admin/analytics).
 *
 * Days are Asia/Ashgabat calendar days as 'YYYY-MM-DD' strings.
 */

export type MetricKind = 'timeseries' | 'topN' | 'kpi' | 'funnel';
export type MetricAccess = 'staff' | 'superuser';
export type MetricUnit = 'count' | 'tmt' | 'percent';
export type Granularity = 'day' | 'week' | 'month';

export interface MetricQueryParams {
  /** First day, inclusive. */
  from: string;
  /** Last day, inclusive. */
  to: string;
  granularity: Granularity;
  /** Row cap for topN widgets. */
  limit: number;
  /** Viewer's locale, for product/category names in topN rows. */
  locale: string;
}

export interface TimeseriesPoint {
  /** Start day of the period: the day, the Monday of the week, or the 1st of the month. */
  period: string;
  value: number;
  /**
   * Set when the range covers only part of this week or month (its first or
   * last period): how many of the period's days the value includes.
   */
  partial?: { days: number; of: number };
}

export interface TimeseriesData {
  kind: 'timeseries';
  /** One entry per line, e.g. 'visitors', 'pageviews_web', 'pageviews_app'. */
  series: { key: string; labelKey: string; points: TimeseriesPoint[] }[];
}

export interface TopNRow {
  /** The grouped value: a productId, a search query, a locale code… */
  key: string;
  /** What to show. Falls back to `key`. */
  label: string;
  value: number;
  imageUrl?: string;
  href?: string;
}

export interface TopNData {
  kind: 'topN';
  rows: TopNRow[];
}

export interface KpiData {
  kind: 'kpi';
  value: number;
  /** Same metric over the equally long range just before `from`, or null if unknown. */
  previous: number | null;
}

export interface FunnelData {
  kind: 'funnel';
  /** In funnel order. Conversion between steps is derived by the dashboard. */
  steps: { key: string; labelKey: string; value: number }[];
}

export type WidgetData = TimeseriesData | TopNData | KpiData | FunnelData;

export type WidgetDataOf<K extends MetricKind> = Extract<
  WidgetData,
  { kind: K }
>;

/** One widget in the `GET /api/admin/analytics` response. */
export interface AnalyticsWidgetResult {
  id: string;
  kind: MetricKind;
  unit: MetricUnit;
  labelKey: string;
  /** null when this widget's query failed; the rest of the response still loads. */
  data: WidgetData | null;
}

/** `data` of the `GET /api/admin/analytics` ResponseApi. */
export interface AnalyticsResponse {
  from: string;
  to: string;
  granularity: Granularity;
  /** Only the widgets the viewer may see, in catalog order. */
  widgets: AnalyticsWidgetResult[];
  /** Carried over from the old /analytics page. */
  userCount: number | null;
  telekomBalance: number | null;
}
