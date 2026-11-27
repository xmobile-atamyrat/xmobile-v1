import type { FunnelData } from '@/lib/analytics/metrics/types';
import { fill, fontClassName, muted, navy } from '@/styles/theme';
import { Box, Typography } from '@mui/material';
import { useTranslations } from 'next-intl';

import { useAnalyticsLabel, WidgetMessage } from './WidgetCard';
import { formatNumber, formatShare } from './format';

type Props = { data: FunnelData; locale: string | undefined };

/** Funnel steps with counts, bars relative to the first step, and step-to-step conversion. */
export default function FunnelWidget({ data, locale }: Props) {
  const t = useTranslations();
  const label = useAnalyticsLabel();
  const { steps } = data;
  const top = steps[0]?.value ?? 0;
  if (steps.length === 0 || top === 0) return <WidgetMessage kind="empty" />;

  const overall = formatShare(steps[steps.length - 1].value, top, locale);

  return (
    <Box className="flex flex-col gap-3">
      <Box component="ol" sx={{ m: 0, p: 0, listStyle: 'none' }}>
        {steps.map((step, index) => {
          const conversion =
            index > 0
              ? formatShare(step.value, steps[index - 1].value, locale)
              : null;
          const width = Math.max((step.value / top) * 100, 1);
          return (
            <Box
              component="li"
              key={step.key}
              data-testid="funnel-step"
              sx={{ py: 0.75 }}
            >
              <Box className="flex flex-row items-baseline justify-between gap-2">
                <Typography
                  fontSize={14}
                  className={fontClassName.className}
                  sx={{ minWidth: 0 }}
                >
                  {label(step.labelKey, step.key)}
                </Typography>
                <Typography
                  fontSize={14}
                  fontWeight={700}
                  color={navy}
                  className={fontClassName.className}
                >
                  {formatNumber(step.value, locale)}
                </Typography>
              </Box>
              <Box
                sx={{
                  mt: 0.5,
                  height: 10,
                  borderRadius: '6px',
                  backgroundColor: fill,
                  overflow: 'hidden',
                }}
              >
                <Box
                  sx={{
                    width: `${width}%`,
                    height: '100%',
                    borderRadius: '6px',
                    backgroundColor: navy,
                    opacity: 1 - index * 0.15,
                  }}
                />
              </Box>
              {index > 0 && (
                <Typography
                  fontSize={12}
                  color={muted}
                  className={fontClassName.className}
                  sx={{ mt: 0.25 }}
                >
                  {t('analyticsStepConversion', {
                    percent: conversion ?? '—',
                  })}
                </Typography>
              )}
            </Box>
          );
        })}
      </Box>
      {steps.length > 1 && overall && (
        <Typography
          fontSize={13}
          fontWeight={600}
          className={fontClassName.className}
        >
          {t('analyticsOverallConversion', { percent: overall })}
        </Typography>
      )}
    </Box>
  );
}
