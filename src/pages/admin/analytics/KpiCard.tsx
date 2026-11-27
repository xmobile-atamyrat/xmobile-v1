import type { KpiData, MetricUnit } from '@/lib/analytics/metrics/types';
import { fontClassName, muted, navy, onlineGreen, red } from '@/styles/theme';
import { Box, Typography } from '@mui/material';
import { useTranslations } from 'next-intl';

import { cardSx, InfoHint } from './WidgetCard';
import { formatValue, kpiDelta } from './format';

type Props = {
  title: string;
  /** Definition behind an info icon next to the title. */
  hint?: string;
  unit: MetricUnit;
  /** null when the widget failed to load. */
  data: KpiData | null;
  locale: string | undefined;
};

const DELTA_COLORS = { up: onlineGreen, down: red, flat: muted } as const;
const DELTA_ARROWS = { up: '▲', down: '▼', flat: '–' } as const;
const DELTA_LABEL_KEYS = {
  up: 'analyticsDeltaUp',
  down: 'analyticsDeltaDown',
  flat: 'analyticsDeltaFlat',
} as const;

/**
 * The title with its info icon glued to the last word, so a wrapping title
 * never leaves the icon alone on a line.
 */
function TitleWithHint({ title, hint }: { title: string; hint: string }) {
  const cut = title.lastIndexOf(' ');
  return (
    <>
      {cut > 0 && `${title.slice(0, cut)} `}
      <Box component="span" sx={{ whiteSpace: 'nowrap' }}>
        {title.slice(cut + 1)} <InfoHint text={hint} />
      </Box>
    </>
  );
}

/** A single number, with its change against the previous period. */
export default function KpiCard({ title, hint, unit, data, locale }: Props) {
  const t = useTranslations();
  const delta = data && kpiDelta(data.value, data.previous, unit, locale);
  const points = (value: string) =>
    delta?.points ? t('analyticsPercentPoints', { value }) : value;
  return (
    <Box
      component="section"
      aria-label={title}
      sx={{ ...cardSx, display: 'flex', flexDirection: 'column', gap: 0.5 }}
    >
      <Typography
        fontSize={13}
        color={muted}
        className={fontClassName.className}
        sx={{ lineHeight: 1.3 }}
      >
        {hint ? <TitleWithHint title={title} hint={hint} /> : title}
      </Typography>
      {data ? (
        <Typography
          fontWeight={700}
          fontSize={22}
          color={navy}
          className={fontClassName.className}
          sx={{ wordBreak: 'break-word', lineHeight: 1.2 }}
        >
          {formatValue(data.value, unit, locale)}
        </Typography>
      ) : (
        <Typography
          fontSize={13}
          color="error"
          className={fontClassName.className}
        >
          {t('analyticsWidgetError')}
        </Typography>
      )}
      {delta && (
        <Typography fontSize={12} className={fontClassName.className}>
          {/* Arrows and signs read badly aloud ("black up-pointing
              triangle"), so screen readers get a sentence instead. */}
          <Box
            component="span"
            aria-hidden
            data-testid="kpi-delta"
            data-direction={delta.direction}
          >
            <Box
              component="span"
              sx={{ color: DELTA_COLORS[delta.direction], fontWeight: 600 }}
            >
              {`${DELTA_ARROWS[delta.direction]} ${points(delta.text)}`}
            </Box>
            <Box component="span" sx={{ color: muted }}>
              {` ${t('analyticsVsPrevious')}`}
            </Box>
          </Box>
          <span className="sr-only" data-testid="kpi-delta-label">
            {t(DELTA_LABEL_KEYS[delta.direction], {
              change: points(delta.magnitude),
            })}
          </span>
        </Typography>
      )}
    </Box>
  );
}

/** A plain number card (user count, Telekom balance) without a delta. */
export function StatCard({
  title,
  value,
}: {
  title: string;
  value: string | null;
}) {
  return (
    <Box
      component="section"
      aria-label={title}
      sx={{ ...cardSx, display: 'flex', flexDirection: 'column', gap: 0.5 }}
    >
      <Typography
        fontSize={13}
        color={muted}
        className={fontClassName.className}
      >
        {title}
      </Typography>
      <Typography
        fontWeight={700}
        fontSize={22}
        color={navy}
        className={fontClassName.className}
      >
        {value ?? '—'}
      </Typography>
    </Box>
  );
}
