import { widgetMeta } from '@/lib/analytics/metrics/catalog';
import { fill, fontClassName, hairline, muted, navy } from '@/styles/theme';
import { Box, Skeleton, Typography } from '@mui/material';
import { useMessages, useTranslations } from 'next-intl';
import type { ReactNode } from 'react';
import { useCallback } from 'react';

/** Translates a flat key, falling back when it's missing from the messages. */
export function useAnalyticsLabel() {
  const t = useTranslations();
  const messages = useMessages() as Record<string, unknown> | undefined;
  return useCallback(
    (key: string, fallback?: string): string =>
      typeof messages?.[key] === 'string' ? t(key) : fallback ?? key,
    [t, messages],
  );
}

export const cardSx = {
  p: 2,
  borderRadius: '14px',
  backgroundColor: '#fff',
  border: `1px solid ${hairline}`,
  minWidth: 0,
} as const;

type Props = {
  title: string;
  /** Widget id, for the superuser badge. */
  widgetId?: string;
  children: ReactNode;
  testId?: string;
};

export default function WidgetCard({
  title,
  widgetId,
  children,
  testId,
}: Props) {
  const t = useTranslations();
  const superuserOnly =
    widgetId != null && widgetMeta(widgetId)?.access === 'superuser';
  return (
    <Box
      component="section"
      aria-label={title}
      data-testid={testId}
      sx={{ ...cardSx, display: 'flex', flexDirection: 'column', gap: 1.5 }}
    >
      <Box className="flex flex-row flex-wrap items-center gap-2">
        <Typography
          component="h2"
          fontWeight={600}
          fontSize={15}
          className={fontClassName.className}
        >
          {title}
        </Typography>
        {superuserOnly && (
          <Typography
            component="span"
            fontSize={11}
            fontWeight={600}
            color={navy}
            className={fontClassName.className}
            sx={{
              px: 1,
              py: 0.25,
              borderRadius: '999px',
              backgroundColor: fill,
            }}
          >
            {t('analyticsSuperuserOnly')}
          </Typography>
        )}
      </Box>
      {children}
    </Box>
  );
}

export function WidgetMessage({
  kind,
}: {
  kind: 'error' | 'empty';
}): JSX.Element {
  const t = useTranslations();
  return (
    <Typography
      fontSize={13}
      color={kind === 'error' ? 'error' : muted}
      className={fontClassName.className}
      sx={{ py: 2 }}
    >
      {kind === 'error' ? t('analyticsWidgetError') : t('analyticsNoData')}
    </Typography>
  );
}

export function WidgetSkeleton({ height }: { height: number }) {
  return (
    <Box sx={cardSx} data-testid="analytics-skeleton">
      <Skeleton variant="text" width="40%" />
      <Skeleton variant="rounded" height={height} sx={{ mt: 1 }} />
    </Box>
  );
}
