import { daysInRange, MS_PER_DAY, previousRange } from '../time';
import type { MetricId, WidgetMeta } from './catalog';
import type { KpiRange, WidgetQueryParams } from './sql';
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
 * What a KPI's compute returns: a number (exact), null (undefined), or a
 * value with its exactness (`exact: false` for an upper bound).
 */
export type KpiValue = number | null | { value: number | null; exact: boolean };

function asMeasured(v: KpiValue): { value: number | null; exact: boolean } {
  return typeof v === 'number' || v === null
    ? { value: v as number | null, exact: true }
    : (v as { value: number | null; exact: boolean });
}

/**
 * A KPI over `from`..`to` and over the equally long range just before it.
 * `compute` may return null for "undefined" (e.g. a rate over zero visitors),
 * and `{ value, exact: false }` for an upper bound.
 *
 * - When the range ends today, today is only partly over, so both ranges are
 *   cut at the same time of day: the current one counts its last day up to
 *   now, the previous one its last day up to `now - N days` (N = the range's
 *   length). `compute` gets that instant as `until`. Each compute counts the
 *   cut day from its source (raw events, or UserOrder for revenue); a source
 *   that no longer has that day (raw events older than the raw window) counts
 *   it in full, which is negligible against a range reaching 90+ days back.
 * - `previous` is null when one value is exact and the other only an upper
 *   bound: the change between them would mean nothing.
 */
export async function kpi(
  { from, to, ctx }: WidgetQueryParams,
  compute: (range: KpiRange) => Promise<KpiValue>,
): Promise<KpiData> {
  const prev = previousRange(from, to);
  const live = to === ctx.today;
  const shiftMs = daysInRange(from, to) * MS_PER_DAY;
  const [current, before] = (
    await Promise.all([
      compute({ from, to, ...(live ? { until: ctx.now } : {}) }),
      compute({
        ...prev,
        ...(live ? { until: new Date(ctx.now.getTime() - shiftMs) } : {}),
      }),
    ])
  ).map(asMeasured);
  return {
    kind: 'kpi',
    value: current.value ?? 0,
    previous: current.exact === before.exact ? before.value : null,
  };
}
