import {
  alignRangeToPeriods,
  analyticsRequestPath,
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
import { Alert, Box, Button, LinearProgress, Typography } from '@mui/material';
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
  const [granularity, setGranularity] = useState<Granularity>('day');

  const selected: Range =
    choice === 'custom' && customRange
      ? customRange
      : presetRange(choice === 'custom' ? DEFAULT_PRESET : choice, today);
  // Whole weeks or months only; the KPIs use the same range, so every number
  // on the page covers the days the range label shows.
  const range = alignRangeToPeriods(selected, granularity);

  // The token goes through a ref: fetchWithCreds stores a silently refreshed
  // one, and a token in the SWR key would refetch for nothing.
  const tokenRef = useRef(accessToken);
  tokenRef.current = accessToken;

  // Who the response is for: what the server decides the widgets by. Another
  // user signing in on this tab (no reload) must never get this one's cache.
  const owner = user ? `${user.id}:${user.grade}` : null;
  const path = analyticsRequestPath({ ...range, granularity, locale });
  const {
    data: cached,
    error,
    isLoading,
    isValidating,
    mutate,
  } = useSWR(
    accessToken && owner ? [path, owner] : null,
    async ([key, keyOwner]: [string, string]): Promise<CachedResponse> => {
      const response = await fetchWithCreds<AnalyticsResponse>({
        accessToken: tokenRef.current ?? '',
        path: key,
        method: 'GET',
      });
      if (!response.success || !response.data) {
        throw new Error(response.message || 'Analytics request failed');
      }
      return { owner: keyOwner, response: response.data };
    },
    {
      keepPreviousData: true,
      revalidateOnFocus: false,
      shouldRetryOnError: false,
      dedupingInterval: 30_000,
    },
  );
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
    let body;
    if (widget.data == null) body = <WidgetMessage kind="error" />;
    else if (widget.data.kind === 'timeseries')
      body = (
        <TimeseriesChart
          unit={widget.unit}
          granularity={data?.granularity ?? granularity}
          data={widget.data}
          locale={locale}
          today={today}
          title={title}
          from={data?.from ?? range.from}
          to={data?.to ?? range.to}
        />
      );
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
        from={selected.from}
        to={selected.to}
        appliedFrom={range.from}
        appliedTo={range.to}
        today={today}
        granularity={granularity}
        onPreset={setChoice}
        onCustom={() => {
          // Start from the dates on screen.
          setCustomRange(selected);
          setChoice('custom');
        }}
        onCustomRange={(from, to) => setCustomRange({ from, to })}
        onGranularity={setGranularity}
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
