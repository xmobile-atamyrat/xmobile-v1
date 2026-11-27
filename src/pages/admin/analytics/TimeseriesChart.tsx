import type {
  Granularity,
  MetricUnit,
  TimeseriesData,
} from '@/lib/analytics/metrics/types';
import { fontClassName, muted } from '@/styles/theme';
import { Box, Skeleton, Typography } from '@mui/material';
import { useTranslations } from 'next-intl';
import dynamic from 'next/dynamic';

import { useAnalyticsLabel, WidgetMessage } from './WidgetCard';
import {
  formatCompact,
  formatDay,
  formatPeriod,
  formatValue,
  periodContaining,
  periodSpan,
} from './format';

const CHART_HEIGHT = 240;

// The chart library only ever loads on this admin page, in the browser.
const LineChart = dynamic(() => import('./PartialLineChart'), {
  ssr: false,
  loading: () => <Skeleton variant="rounded" height={CHART_HEIGHT} />,
});

export const SERIES_COLORS = [
  '#20166E',
  '#E41E2B',
  '#1F9A5A',
  '#E08A00',
  '#0E7DC2',
  '#8B5CF6',
];

type Props = {
  unit: MetricUnit;
  granularity: Granularity;
  data: TimeseriesData;
  locale: string | undefined;
  /** Today (Ashgabat), to flag a last period that isn't over yet. */
  today?: string;
  /**
   * The chart's title (for its spoken summary) and the selected range, which
   * the first and last week or month may only partly cover.
   */
  title: string;
  from: string;
  to: string;
};

/** Every period any series has, sorted; a series without a point there counts 0. */
export function alignSeries(data: TimeseriesData): {
  periods: string[];
  values: number[][];
} {
  const periods = [
    ...new Set(data.series.flatMap((s) => s.points.map((p) => p.period))),
  ].sort();
  const values = data.series.map((s) => {
    const byPeriod = new Map(s.points.map((p) => [p.period, p.value]));
    return periods.map((period) => byPeriod.get(period) ?? 0);
  });
  return { periods, values };
}

export default function TimeseriesChart({
  unit,
  granularity,
  data,
  locale,
  today,
  title,
  from,
  to,
}: Props) {
  const t = useTranslations();
  const label = useAnalyticsLabel();
  const { periods, values } = alignSeries(data);
  if (periods.length === 0) return <WidgetMessage kind="empty" />;

  const format = (value: number | null) =>
    value == null ? '' : formatValue(value, unit, locale);
  // The SVG means nothing to a screen reader: say what it shows instead.
  const summary = t('analyticsChartSummary', {
    title,
    from: formatDay(from),
    to: formatDay(to),
    period: formatDay(periods[periods.length - 1]),
    values: data.series
      .map(
        (s, index) =>
          `${label(s.labelKey, s.key)} ${format(values[index].at(-1) ?? 0)}`,
      )
      .join(', '),
  });
  // A week or month the range cuts short: drawn faded, and its tooltip says
  // how many of its days it covers.
  const partialByPeriod = new Map(
    data.series.flatMap((s) =>
      s.points.flatMap((p) => (p.partial ? [[p.period, p.partial]] : [])),
    ) as [string, { days: number; of: number }][],
  );
  const partialIndexes = periods.flatMap((period, index) =>
    partialByPeriod.has(period) ? [index] : [],
  );
  const showMarks = periods.length <= 31;
  // The last point covers today, so it is lower than it will end up. When it
  // is already marked partial, the partial note says enough.
  const lastIsToday =
    today != null &&
    periods.at(-1) === periodContaining(today, granularity) &&
    !partialByPeriod.has(periods.at(-1) ?? '');
  const tooltipTitle = (period: string) => {
    if (granularity === 'day') return formatDay(period);
    const span = periodSpan(period, granularity, from, to);
    const dates =
      span.from === span.to
        ? formatDay(span.from)
        : `${formatDay(span.from)} – ${formatDay(span.to)}`;
    const partial = partialByPeriod.get(period);
    return partial
      ? `${dates} (${t('analyticsPartialPointDays', partial)})`
      : dates;
  };

  return (
    <Box>
      <Box
        component="ul"
        className="flex flex-row flex-wrap gap-x-4 gap-y-1"
        sx={{ m: 0, p: 0, listStyle: 'none' }}
      >
        {data.series.map((s, index) => (
          <Box
            component="li"
            key={s.key}
            className="flex flex-row items-center gap-1.5"
            data-testid="series-legend"
          >
            <Box
              aria-hidden
              sx={{
                width: 10,
                height: 10,
                borderRadius: '3px',
                backgroundColor: SERIES_COLORS[index % SERIES_COLORS.length],
              }}
            />
            <Typography
              fontSize={12}
              color={muted}
              className={fontClassName.className}
            >
              {label(s.labelKey, s.key)}
            </Typography>
          </Box>
        ))}
      </Box>
      <Box
        role="img"
        aria-label={summary}
        data-testid="chart-summary"
        sx={{ height: CHART_HEIGHT, mx: -1 }}
      >
        <LineChart
          partialIndexes={partialIndexes}
          height={CHART_HEIGHT}
          // The right margin leaves room for half of the last tick label
          // ("11.2026"), which is centred on the last point.
          margin={{ top: 16, right: 36, bottom: 28, left: 56 }}
          grid={{ horizontal: true }}
          slotProps={{ legend: { hidden: true } }}
          xAxis={[
            {
              scaleType: 'point',
              data: periods,
              valueFormatter: (period: string, context) =>
                context.location === 'tooltip'
                  ? tooltipTitle(period)
                  : // A week the range starts mid-way is labelled by its
                    // first day in range, not a Monday before the range.
                    formatPeriod(
                      granularity === 'week'
                        ? periodSpan(period, granularity, from, to).from
                        : period,
                      granularity,
                    ),
            },
          ]}
          yAxis={[
            {
              valueFormatter: (value: number) =>
                unit === 'percent'
                  ? formatValue(value, unit, locale)
                  : formatCompact(value, locale),
            },
          ]}
          series={data.series.map((s, index) => ({
            id: s.key,
            data: values[index],
            label: label(s.labelKey, s.key),
            color: SERIES_COLORS[index % SERIES_COLORS.length],
            showMark: ({ index: point }: { index: number }) =>
              showMarks || partialIndexes.includes(point),
            curve: 'linear' as const,
            valueFormatter: format,
          }))}
        />
      </Box>
      {partialIndexes.length > 0 && (
        <Typography
          fontSize={12}
          color={muted}
          className={fontClassName.className}
          data-testid="partial-points-note"
          sx={{ mt: 0.5 }}
        >
          {t('analyticsPartialPointsNote')}
        </Typography>
      )}
      {lastIsToday && (
        <Typography
          fontSize={12}
          color={muted}
          className={fontClassName.className}
          data-testid="partial-period-note"
          sx={{ mt: 0.5 }}
        >
          {label('analyticsPartialPeriodNote', '')}
        </Typography>
      )}
    </Box>
  );
}
