import {
  analyticsRequestPath,
  ashgabatDay,
  presetRange,
  type RangePreset,
} from '@/lib/analytics/adminQuery';
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
import { useMemo, useRef, useState } from 'react';
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
import { formatNumber } from './format';

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
  /** Today in Ashgabat; injectable for tests. */
  today?: string;
};

export default function AnalyticsDashboard({ today: todayProp }: Props) {
  const t = useTranslations();
  const label = useAnalyticsLabel();
  const { locale } = useRouter();
  const { accessToken } = useUserContext();
  const fetchWithCreds = useFetchWithCreds();

  const today = useMemo(() => todayProp ?? ashgabatDay(), [todayProp]);
  const [choice, setChoice] = useState<RangeChoice>(DEFAULT_PRESET);
  const [range, setRange] = useState(() => presetRange(DEFAULT_PRESET, today));
  const [granularity, setGranularity] = useState<Granularity>('day');

  // The token goes through a ref: fetchWithCreds stores a silently refreshed
  // one, and a token in the SWR key would refetch for nothing.
  const tokenRef = useRef(accessToken);
  tokenRef.current = accessToken;

  const path = analyticsRequestPath({ ...range, granularity, locale });
  const { data, error, isLoading, isValidating, mutate } = useSWR(
    accessToken ? path : null,
    async (key: string) => {
      const response = await fetchWithCreds<AnalyticsResponse>({
        accessToken: tokenRef.current ?? '',
        path: key,
        method: 'GET',
      });
      if (!response.success || !response.data) {
        throw new Error(response.message || 'Analytics request failed');
      }
      return response.data;
    },
    {
      keepPreviousData: true,
      revalidateOnFocus: false,
      shouldRetryOnError: false,
      dedupingInterval: 30_000,
    },
  );

  const byKind = (kind: AnalyticsWidgetResult['kind']) =>
    (data?.widgets ?? []).filter((widget) => widget.kind === kind);
  const kpis = byKind('kpi');
  const charts = (data?.widgets ?? []).filter(
    (widget) => widget.kind === 'timeseries' || widget.kind === 'funnel',
  );
  const lists = byKind('topN');

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
        />
      );
    else if (widget.data.kind === 'funnel')
      body = <FunnelWidget data={widget.data} locale={locale} />;
    return (
      <WidgetCard
        key={widget.id}
        title={title}
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
        granularity={granularity}
        onPreset={(preset) => {
          setChoice(preset);
          setRange(presetRange(preset, today));
        }}
        onCustom={() => setChoice('custom')}
        onCustomRange={(from, to) => setRange({ from, to })}
        onGranularity={setGranularity}
      />

      <Box sx={{ height: 4 }}>
        {isValidating && data && (
          <LinearProgress aria-label={t('loading')} sx={{ borderRadius: 2 }} />
        )}
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
                  : `${formatNumber(data.telekomBalance, locale)} TMT`
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
