import type {
  MetricUnit,
  TopNData,
  TopNRow,
} from '@/lib/analytics/metrics/types';
import { fill, fontClassName, muted, navy } from '@/styles/theme';
import { Box, Link as MuiLink, Typography } from '@mui/material';
import Link from 'next/link';

import { useAnalyticsLabel, WidgetMessage } from './WidgetCard';
import { BREAKDOWN_LABEL_KEYS, formatValue } from './format';

type Props = {
  widgetId: string;
  unit: MetricUnit;
  data: TopNData;
  locale: string | undefined;
};

/** Ranked rows with a bar relative to the first (largest) one. */
export default function TopNList({ widgetId, unit, data, locale }: Props) {
  const label = useAnalyticsLabel();
  const { rows } = data;
  if (rows.length === 0) return <WidgetMessage kind="empty" />;

  const max = Math.max(...rows.map((row) => row.value), 0);
  const rowLabel = (row: TopNRow): string => {
    const key = BREAKDOWN_LABEL_KEYS[widgetId]?.[row.key];
    if (key) return label(key, row.label || row.key);
    return row.label || row.key || label('analyticsUnknown');
  };

  return (
    <Box component="ol" sx={{ m: 0, p: 0, listStyle: 'none' }}>
      {rows.map((row, index) => {
        const text = rowLabel(row);
        return (
          <Box
            component="li"
            key={row.key || `row-${index}`}
            data-testid="topn-row"
            className="flex flex-row items-center gap-2"
            sx={{ py: 0.75 }}
          >
            <Typography
              fontSize={12}
              color={muted}
              className={fontClassName.className}
              sx={{ width: 18, flexShrink: 0, textAlign: 'right' }}
            >
              {index + 1}
            </Typography>
            {row.imageUrl && (
              <Box
                component="img"
                src={row.imageUrl}
                alt=""
                loading="lazy"
                sx={{
                  width: 32,
                  height: 32,
                  flexShrink: 0,
                  objectFit: 'contain',
                  borderRadius: '6px',
                  backgroundColor: fill,
                }}
              />
            )}
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Box className="flex flex-row items-baseline justify-between gap-2">
                {row.href ? (
                  <MuiLink
                    component={Link}
                    href={row.href}
                    underline="hover"
                    color="inherit"
                    noWrap
                    title={text}
                    className={fontClassName.className}
                    sx={{ fontSize: 14, minWidth: 0 }}
                  >
                    {text}
                  </MuiLink>
                ) : (
                  <Typography
                    fontSize={14}
                    noWrap
                    title={text}
                    className={fontClassName.className}
                    sx={{ minWidth: 0 }}
                  >
                    {text}
                  </Typography>
                )}
                <Typography
                  fontSize={14}
                  fontWeight={600}
                  color={navy}
                  className={fontClassName.className}
                  sx={{ flexShrink: 0 }}
                >
                  {formatValue(row.value, unit, locale)}
                </Typography>
              </Box>
              <Box
                aria-hidden
                sx={{
                  mt: 0.5,
                  height: 4,
                  borderRadius: '2px',
                  backgroundColor: fill,
                  overflow: 'hidden',
                }}
              >
                <Box
                  sx={{
                    width: `${max > 0 ? (row.value / max) * 100 : 0}%`,
                    height: '100%',
                    backgroundColor: navy,
                    opacity: 0.7,
                  }}
                />
              </Box>
            </Box>
          </Box>
        );
      })}
    </Box>
  );
}
