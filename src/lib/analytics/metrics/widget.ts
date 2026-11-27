import { previousRange } from '../time';
import type { MetricId, WidgetMeta } from './catalog';
import type { WidgetQueryParams } from './sql';
import type { KpiData, MetricKind, WidgetDataOf } from './types';

/** The catalog `kind` of a widget id. */
export type WidgetKindOf<Id extends MetricId> = Extract<
  WidgetMeta,
  { id: Id }
>['kind'];

export type WidgetQuery<K extends MetricKind> = (
  params: WidgetQueryParams,
) => Promise<WidgetDataOf<K>>;

/**
 * One query per catalog widget, returning data of the widget's own kind.
 * Adding a widget to WIDGETS without an entry here is a type error.
 */
export type WidgetRegistry = {
  [Id in MetricId]: WidgetQuery<WidgetKindOf<Id>>;
};

/** What each metric file exports: the entries for its widgets. */
export type WidgetGroup = Partial<WidgetRegistry>;

/**
 * A KPI over `from`..`to` and over the equally long range just before it.
 * `compute` may return null for "undefined" (e.g. a rate over zero visitors).
 */
export async function kpi(
  { from, to }: WidgetQueryParams,
  compute: (rangeFrom: string, rangeTo: string) => Promise<number | null>,
): Promise<KpiData> {
  const prev = previousRange(from, to);
  const [value, previous] = await Promise.all([
    compute(from, to),
    compute(prev.from, prev.to),
  ]);
  return { kind: 'kpi', value: value ?? 0, previous };
}
