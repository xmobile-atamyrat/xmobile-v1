import { rawWindowStart } from '../time';
import { breakdownsWidgets } from './breakdowns';
import type { MetricId } from './catalog';
import { ordersWidgets } from './orders';
import { productsWidgets } from './products';
import { revenueWidgets } from './revenue';
import { searchWidgets } from './search';
import { contextFor } from './sql';
import { trafficWidgets } from './traffic';
import type { MetricQueryParams, WidgetData } from './types';
import type { WidgetRegistry } from './widget';

/**
 * Metric registry (extension point #2 in docs/analytics-design.md).
 *
 * Each file in this folder owns a group of widgets: its daily rollups (see
 * rollup.ts) and a query per widget id. Adding a widget means adding it to
 * WIDGETS in catalog.ts and an entry to one group here; until the entry
 * exists, `widgetQueries` below fails to type-check, and an entry whose data
 * has a different `kind` than the catalog says does too.
 */
export const widgetQueries: WidgetRegistry = {
  ...trafficWidgets,
  ...ordersWidgets,
  ...revenueWidgets,
  ...productsWidgets,
  ...searchWidgets,
  ...breakdownsWidgets,
};

/**
 * Data for one widget over the Ashgabat days `params.from`..`params.to`.
 * `options.now` pins the clock (tests): it decides which days still have raw
 * events, and so whether unique counts and the funnel are exact.
 */
export function queryWidget(
  id: MetricId,
  params: MetricQueryParams,
  options: { now?: Date } = {},
): Promise<WidgetData> {
  const query = widgetQueries[id] as (
    p: Parameters<WidgetRegistry[MetricId]>[0],
  ) => Promise<WidgetData>;
  if (!query) {
    return Promise.reject(new Error(`Unknown analytics widget: ${id}`));
  }
  const now = options.now ?? new Date();
  return query({ ...params, ctx: contextFor(now, rawWindowStart(now)) });
}

export type { WidgetRegistry } from './widget';
