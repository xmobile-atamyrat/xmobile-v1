import { widgetMeta } from '@/lib/analytics/metrics/catalog';
import { fill, fontClassName, hairline, muted, navy } from '@/styles/theme';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import {
  Box,
  ClickAwayListener,
  IconButton,
  Skeleton,
  Tooltip,
  Typography,
} from '@mui/material';
import { useMessages, useTranslations } from 'next-intl';
import type { ReactNode } from 'react';
import { useCallback, useState } from 'react';

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

/**
 * An info icon whose tooltip defines the metric. Hover opens it on desktop;
 * a tap (or click) opens it and tapping elsewhere closes it, since touch
 * tooltips don't open reliably on phones, where most admins are.
 */
export function InfoHint({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  return (
    <ClickAwayListener onClickAway={() => setOpen(false)}>
      <Box
        component="span"
        sx={{ display: 'inline-flex', verticalAlign: 'middle' }}
      >
        <Tooltip
          title={text}
          arrow
          open={open}
          onOpen={() => setOpen(true)}
          onClose={() => setOpen(false)}
          disableTouchListener
          describeChild
        >
          <IconButton
            size="small"
            aria-label={text}
            data-testid="analytics-hint"
            onClick={() => setOpen(true)}
            sx={{ p: 0.25, color: muted }}
          >
            <InfoOutlinedIcon sx={{ fontSize: 16 }} />
          </IconButton>
        </Tooltip>
      </Box>
    </ClickAwayListener>
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
  /** Definition behind an info icon next to the title. */
  hint?: string;
  children: ReactNode;
  testId?: string;
};

export default function WidgetCard({
  title,
  widgetId,
  hint,
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
      <Box className="flex flex-row flex-wrap items-center gap-1">
        <Typography
          component="h2"
          fontWeight={600}
          fontSize={15}
          className={fontClassName.className}
        >
          {title}
        </Typography>
        {hint && <InfoHint text={hint} />}
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
