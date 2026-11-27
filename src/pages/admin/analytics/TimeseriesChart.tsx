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
} from './format';

const CHART_HEIGHT = 240;

// The chart library only ever loads on this admin page, in the browser.
const LineChart = dynamic(
  () => import('@mui/x-charts/LineChart').then((module) => module.LineChart),
  {
    ssr: false,
    loading: () => <Skeleton variant="rounded" height={CHART_HEIGHT} />,
  },
);

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
  /** For the chart's spoken summary: its title and the range it covers. */
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
  const showMarks = periods.length <= 31;
  // The last point covers today, so it is lower than it will end up.
  const lastIsPartial =
    today != null && periods.at(-1) === periodContaining(today, granularity);

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
                  ? formatDay(period)
                  : formatPeriod(period, granularity),
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
            showMark: showMarks,
            curve: 'linear' as const,
            valueFormatter: format,
          }))}
        />
      </Box>
      {lastIsPartial && (
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
