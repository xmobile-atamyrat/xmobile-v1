import {
  analyticsRequestPath,
  chartIntervals,
  defaultChartInterval,
  GRANULARITIES,
  presetRange,
  type RangePreset,
} from '@/lib/analytics/adminQuery';
import {
  WIDGET_HINT_KEYS,
  type MetricId,
} from '@/lib/analytics/metrics/catalog';
import type {
  AnalyticsResponse,
  AnalyticsWidgetResult,
  Granularity,
} from '@/lib/analytics/metrics/types';
import { useFetchWithCreds } from '@/pages/lib/fetch';
import { useUserContext } from '@/pages/lib/UserContext';
import { fontClassName } from '@/styles/theme';
import {
  Alert,
  Box,
  Button,
  LinearProgress,
  Skeleton,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/router';
import { useRef, useState } from 'react';
import useSWR from 'swr';

import AnalyticsControls, { type RangeChoice } from './AnalyticsControls';
import FunnelWidget from './FunnelWidget';
import KpiCard, { StatCard } from './KpiCard';
import TimeseriesChart from './TimeseriesChart';
import TopNList from './TopNList';
import WidgetCard, {
  useAnalyticsLabel,
  WidgetMessage,
  WidgetSkeleton,
} from './WidgetCard';
import { formatNumber, formatTmtExact } from './format';
import { useAshgabatToday } from './useAshgabatToday';

const DEFAULT_PRESET: RangePreset = '30d';

const KPI_GRID = {
  display: 'grid',
  gridTemplateColumns: {
    xs: 'repeat(2, minmax(0, 1fr))',
    sm: 'repeat(auto-fill, minmax(180px, 1fr))',
  },
  gap: 1.5,
} as const;

const WIDE_GRID = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 460px), 1fr))',
  gap: 1.5,
} as const;

const LIST_GRID = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 320px), 1fr))',
  gap: 1.5,
} as const;

type Props = {
  /** Today in Ashgabat, fixed; injectable for tests. */
  today?: string;
};

type Range = { from: string; to: string };

/**
 * What the SWR cache holds: the response plus whose it is. The key carries
 * the user too, but `keepPreviousData` would still hand the last user's
 * response to the next one while theirs loads, so the owner is checked again
 * on read.
 */
type CachedResponse = { owner: string; response: AnalyticsResponse };

type Fetcher = (key: [string, string]) => Promise<CachedResponse>;

const SWR_OPTIONS = {
  revalidateOnFocus: false,
  shouldRetryOnError: false,
  dedupingInterval: 30_000,
} as const;

const INTERVAL_LABEL_KEYS: Record<Granularity, string> = {
  day: 'analyticsGranularityDay',
  week: 'analyticsGranularityWeek',
  month: 'analyticsGranularityMonth',
};

type ChartCardProps = {
  /** The chart as the dashboard's request returned it, at `defaultInterval`. */
  widget: AnalyticsWidgetResult;
  title: string;
  hint?: string;
  interval: Granularity;
  defaultInterval: Granularity;
  /** Intervals that make sense for the range; the others are disabled. */
  intervals: readonly Granularity[];
  onInterval: (interval: Granularity) => void;
  range: Range;
  locale: string | undefined;
  today: string;
  /** User and role the cache belongs to; null while signed out. */
  owner: string | null;
  fetcher: Fetcher;
};

/**
 * A line chart with its own interval. At the default interval it shows what
 * the dashboard's request returned; at another it fetches just this chart.
 * The interval changes only how the chart groups its points: every other
 * number on the page follows the range alone.
 */
function ChartCard({
  widget,
  title,
  hint,
  interval,
  defaultInterval,
  intervals,
  onInterval,
  range,
  locale,
  today,
  owner,
  fetcher,
}: ChartCardProps) {
  const t = useTranslations();
  const ownRequest = interval !== defaultInterval;
  const path = analyticsRequestPath({
    ...range,
    granularity: interval,
    locale,
    widgets: [widget.id],
  });
  // No keepPreviousData: the last interval's points under this interval's
  // labels would be wrong, so a skeleton shows while it loads.
  const { data: cached, error } = useSWR(
    ownRequest && owner ? [path, owner] : null,
    fetcher,
    SWR_OPTIONS,
  );
  const own =
    cached && cached.owner === owner
      ? cached.response.widgets.find((w) => w.id === widget.id)
      : undefined;
  const data = ownRequest ? own?.data : widget.data;

  let body;
  if (ownRequest && own === undefined) {
    body = error ? (
      <WidgetMessage kind="error" />
    ) : (
      <Skeleton variant="rounded" height={240} />
    );
  } else if (data?.kind === 'timeseries') {
    body = (
      <TimeseriesChart
        unit={widget.unit}
        granularity={interval}
        data={data}
        locale={locale}
        today={today}
        title={title}
        from={range.from}
        to={range.to}
      />
    );
  } else {
    body = <WidgetMessage kind="error" />;
  }

  return (
    <WidgetCard
      title={title}
      hint={hint}
      widgetId={widget.id}
      testId={`widget-${widget.id}`}
      action={
        <ToggleButtonGroup
          exclusive
          size="small"
          value={interval}
          aria-label={t('analyticsChartInterval', { title })}
          onChange={(_event, value: Granularity | null) => {
            if (value) onInterval(value);
          }}
        >
          {GRANULARITIES.map((value) => (
            <ToggleButton
              key={value}
              value={value}
              disabled={!intervals.includes(value)}
              className={fontClassName.className}
              sx={{ textTransform: 'none', px: 1.25, py: 0.25, fontSize: 13 }}
            >
              {t(INTERVAL_LABEL_KEYS[value])}
            </ToggleButton>
          ))}
        </ToggleButtonGroup>
      }
    >
      {body}
    </WidgetCard>
  );
}

export default function AnalyticsDashboard({ today: todayProp }: Props) {
  const t = useTranslations();
  const label = useAnalyticsLabel();
  const hintFor = (id: string): string | undefined => {
    const key = WIDGET_HINT_KEYS[id as MetricId];
    return key ? label(key) : undefined;
  };
  const { locale } = useRouter();
  const { user, accessToken } = useUserContext();
  const fetchWithCreds = useFetchWithCreds();

  // Kept current past midnight, so presets keep ending today.
  const today = useAshgabatToday(todayProp);
  const [choice, setChoice] = useState<RangeChoice>(DEFAULT_PRESET);
  const [customRange, setCustomRange] = useState<Range | null>(null);

  // The one range every number on the page covers.
  const range: Range =
    choice === 'custom' && customRange
      ? customRange
      : presetRange(choice === 'custom' ? DEFAULT_PRESET : choice, today);

  // Charts open at an interval that suits the range; one picked on a chart
  // lasts until the range changes.
  const defaultInterval = defaultChartInterval(range.from, range.to);
  const intervals = chartIntervals(range.from, range.to);
  const rangeKey = `${range.from}|${range.to}`;
  const [picked, setPicked] = useState<{
    rangeKey: string;
    byChart: Partial<Record<string, Granularity>>;
  }>({ rangeKey, byChart: {} });
  const intervalOf = (id: string): Granularity =>
    (picked.rangeKey === rangeKey ? picked.byChart[id] : undefined) ??
    defaultInterval;
  const pickInterval = (id: string, interval: Granularity) =>
    setPicked((current) => ({
      rangeKey,
      byChart: {
        ...(current.rangeKey === rangeKey ? current.byChart : {}),
        [id]: interval,
      },
    }));

  // The token goes through a ref: fetchWithCreds stores a silently refreshed
  // one, and a token in the SWR key would refetch for nothing.
  const tokenRef = useRef(accessToken);
  tokenRef.current = accessToken;

  // Who the response is for: what the server decides the widgets by. Another
  // user signing in on this tab (no reload) must never get this one's cache.
  const owner = user ? `${user.id}:${user.grade}` : null;
  const path = analyticsRequestPath({
    ...range,
    granularity: defaultInterval,
    locale,
  });
  const fetcher: Fetcher = async ([key, keyOwner]) => {
    const response = await fetchWithCreds<AnalyticsResponse>({
      accessToken: tokenRef.current ?? '',
      path: key,
      method: 'GET',
    });
    if (!response.success || !response.data) {
      throw new Error(response.message || 'Analytics request failed');
    }
    return { owner: keyOwner, response: response.data };
  };
  const {
    data: cached,
    error,
    isLoading,
    isValidating,
    mutate,
  } = useSWR(accessToken && owner ? [path, owner] : null, fetcher, {
    ...SWR_OPTIONS,
    keepPreviousData: true,
  });
  const data = cached && cached.owner === owner ? cached.response : undefined;

  const byKind = (kind: AnalyticsWidgetResult['kind']) =>
    (data?.widgets ?? []).filter((widget) => widget.kind === kind);
  const kpis = byKind('kpi');
  const charts = (data?.widgets ?? []).filter(
    (widget) => widget.kind === 'timeseries' || widget.kind === 'funnel',
  );
  const lists = byKind('topN');
  const failedCount = (data?.widgets ?? []).filter(
    (widget) => widget.data == null,
  ).length;

  const renderWide = (widget: AnalyticsWidgetResult) => {
    const title = label(widget.labelKey, widget.id);
    if (widget.kind === 'timeseries') {
      return (
        <ChartCard
          key={widget.id}
          widget={widget}
          title={title}
          hint={hintFor(widget.id)}
          interval={intervalOf(widget.id)}
          defaultInterval={defaultInterval}
          intervals={intervals}
          onInterval={(interval) => pickInterval(widget.id, interval)}
          range={range}
          locale={locale}
          today={today}
          owner={owner}
          fetcher={fetcher}
        />
      );
    }
    let body;
    if (widget.data == null) body = <WidgetMessage kind="error" />;
    else if (widget.data.kind === 'funnel')
      body = <FunnelWidget data={widget.data} locale={locale} />;
    return (
      <WidgetCard
        key={widget.id}
        title={title}
        hint={hintFor(widget.id)}
        widgetId={widget.id}
        testId={`widget-${widget.id}`}
      >
        {body}
      </WidgetCard>
    );
  };

  return (
    <Box className="flex flex-col gap-4">
      <AnalyticsControls
        choice={choice}
        from={range.from}
        to={range.to}
        today={today}
        onPreset={setChoice}
        onCustom={() => {
          // Start from the dates on screen.
          setCustomRange(range);
          setChoice('custom');
        }}
        onCustomRange={(from, to) => setCustomRange({ from, to })}
      />

      <Box sx={{ height: 4 }}>
        {isValidating && data && (
          <LinearProgress aria-label={t('loading')} sx={{ borderRadius: 2 }} />
        )}
      </Box>

      {/* One polite announcement for failed blocks, rather than an alert per
          card. Always rendered, so screen readers pick up its changes. */}
      <Box role="status" className="sr-only" data-testid="analytics-status">
        {failedCount > 0
          ? t('analyticsWidgetsFailed', { count: failedCount })
          : ''}
      </Box>

      {error && !isValidating && (
        <Alert
          severity="error"
          action={
            <Button color="inherit" size="small" onClick={() => mutate()}>
              {t('analyticsRetry')}
            </Button>
          }
        >
          {t('analyticsLoadError')}
        </Alert>
      )}

      {!data && isLoading && (
        <>
          <Box sx={KPI_GRID}>
            {Array.from({ length: 6 }, (_, index) => (
              <WidgetSkeleton key={index} height={40} />
            ))}
          </Box>
          <Box sx={WIDE_GRID}>
            <WidgetSkeleton height={240} />
            <WidgetSkeleton height={240} />
          </Box>
        </>
      )}

      {data && (
        <>
          <Box sx={KPI_GRID} data-testid="analytics-kpis">
            {kpis.map((widget) => (
              <KpiCard
                key={widget.id}
                title={label(widget.labelKey, widget.id)}
                hint={hintFor(widget.id)}
                unit={widget.unit}
                data={widget.data?.kind === 'kpi' ? widget.data : null}
                locale={locale}
              />
            ))}
            <StatCard
              title={t('totalUserCount')}
              value={
                data.userCount == null
                  ? null
                  : formatNumber(data.userCount, locale)
              }
            />
            <StatCard
              title={t('telekomBalance')}
              value={
                data.telekomBalance == null
                  ? null
                  : formatTmtExact(data.telekomBalance, locale)
              }
            />
          </Box>

          {charts.length > 0 && (
            <Box sx={WIDE_GRID}>{charts.map(renderWide)}</Box>
          )}

          {lists.length > 0 && (
            <Box sx={LIST_GRID}>
              {lists.map((widget) => (
                <WidgetCard
                  key={widget.id}
                  title={label(widget.labelKey, widget.id)}
                  hint={hintFor(widget.id)}
                  widgetId={widget.id}
                  testId={`widget-${widget.id}`}
                >
                  {widget.data?.kind === 'topN' ? (
                    <TopNList
                      widgetId={widget.id}
                      unit={widget.unit}
                      data={widget.data}
                      locale={locale}
                    />
                  ) : (
                    <WidgetMessage kind="error" />
                  )}
                </WidgetCard>
              ))}
            </Box>
          )}
        </>
      )}

      {data && data.widgets.length === 0 && (
        <Typography color="text.secondary" className={fontClassName.className}>
          {t('analyticsNoData')}
        </Typography>
      )}
    </Box>
  );
}
