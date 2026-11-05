import { usePlatform } from '@/pages/lib/PlatformContext';
import {
  formatAmount,
  PricesFilter,
  PricesSummary as Summary,
} from '@/pages/procurement/lib/priceInput';
import { procurementClasses as c } from '@/styles/classMaps/procurement';
import { pricesClasses as pc } from '@/styles/classMaps/procurement/prices';
import { fontClassName } from '@/styles/theme';
import { Box, ButtonBase, Typography } from '@mui/material';
import { useTranslations } from 'next-intl';

interface PricesSummaryProps {
  summary: Summary;
  currency: string;
  filter: PricesFilter;
  onFilter: (filter: PricesFilter) => void;
}

/** "X of Y prices filled", the chosen total, and the All/Missing/Chosen chips. */
export default function PricesSummary({
  summary,
  currency,
  filter,
  onFilter,
}: PricesSummaryProps) {
  const t = useTranslations();
  const platform = usePlatform();
  const font = fontClassName.className;
  const percent =
    summary.total === 0
      ? 0
      : Math.round((summary.filled / summary.total) * 100);

  const chips: { key: PricesFilter; label: string; count?: number }[] = [
    { key: 'all', label: t('all') },
    {
      key: 'missing',
      label: t('procurementFilterMissing'),
      count: summary.missingProductIds.size,
    },
    {
      key: 'chosen',
      label: t('procurementFilterChosen'),
      count: summary.chosenProductIds.size,
    },
  ];

  return (
    <Box
      className={platform === 'web' ? pc.summaryWeb : pc.summary}
      data-testid="prices-summary"
    >
      {summary.total === 0 ? (
        <Typography className={`${font} ${pc.hint}`}>
          {t('procurementNoOrderedProducts')}
        </Typography>
      ) : (
        <Box className="flex flex-col gap-2 min-w-[200px] flex-1">
          <Box className={pc.summaryStats}>
            <Box>
              <Typography className={`${font} ${pc.statValue}`}>
                {summary.filled}
                <span className="text-muted font-semibold text-[15px]">
                  {' / '}
                  {summary.total}
                </span>
              </Typography>
              <Typography className={`${font} ${pc.statLabel}`}>
                {t('procurementPricesFilled')}
              </Typography>
            </Box>
            {summary.chosenCount > 0 && (
              <Box>
                <Typography className={`${font} ${pc.statValueGreen}`}>
                  {formatAmount(summary.chosenTotal)}{' '}
                  <span className="text-[13px] font-semibold">{currency}</span>
                </Typography>
                <Typography className={`${font} ${pc.statLabel}`}>
                  {t('procurementChosenTotal')}
                </Typography>
              </Box>
            )}
          </Box>
          <Box
            className={pc.progressTrack}
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={percent}
          >
            <Box className={pc.progressFill} style={{ width: `${percent}%` }} />
          </Box>
        </Box>
      )}
      <Box className={pc.chips} role="group" aria-label={t('prices')}>
        {chips.map((chip) => (
          <ButtonBase
            key={chip.key}
            disableRipple
            aria-pressed={filter === chip.key}
            onClick={() => onFilter(chip.key)}
            className={`${font} ${pc.chip} ${
              filter === chip.key ? pc.chipActive : pc.chipIdle
            }`}
          >
            {chip.label}
            {chip.count != null && (
              <span className={c.pillCount}>{chip.count}</span>
            )}
          </ButtonBase>
        ))}
      </Box>
    </Box>
  );
}
