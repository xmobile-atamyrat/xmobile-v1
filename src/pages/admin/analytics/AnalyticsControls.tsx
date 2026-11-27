import {
  GRANULARITIES,
  MAX_RANGE_DAYS,
  MIN_ANALYTICS_DAY,
  RANGE_PRESETS,
  type RangePreset,
  isValidDay,
  rangeDays,
} from '@/lib/analytics/adminQuery';
import type { Granularity } from '@/lib/analytics/metrics/types';
import { fontClassName, muted, navy } from '@/styles/theme';
import {
  Box,
  Chip,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';

import { formatDay } from './format';

export type RangeChoice = RangePreset | 'custom';

const PRESET_LABEL_KEYS: Record<RangeChoice, string> = {
  '7d': 'analyticsRange7d',
  '30d': 'analyticsRange30d',
  '90d': 'analyticsRange90d',
  '12m': 'analyticsRange12m',
  custom: 'analyticsRangeCustom',
};

const GRANULARITY_LABEL_KEYS: Record<Granularity, string> = {
  day: 'analyticsGranularityDay',
  week: 'analyticsGranularityWeek',
  month: 'analyticsGranularityMonth',
};

type Props = {
  choice: RangeChoice;
  /** The selected range: a preset's days, or the custom dates. */
  from: string;
  to: string;
  /**
   * The range actually shown, which for week and month starts at the
   * beginning of the first period (see alignRangeToPeriods).
   */
  appliedFrom: string;
  appliedTo: string;
  /** Today in Ashgabat: the latest day a custom range may end on. */
  today: string;
  granularity: Granularity;
  onPreset: (preset: RangePreset) => void;
  /** Called with a valid custom range only. */
  onCustomRange: (from: string, to: string) => void;
  onCustom: () => void;
  onGranularity: (granularity: Granularity) => void;
};

type RangeError =
  | 'analyticsRangeIncomplete'
  | 'analyticsRangeOutOfBounds'
  | 'analyticsInvalidRange'
  | 'analyticsRangeTooLong'
  | null;

/**
 * What's wrong with a custom range, or null. A date input reports '' while
 * its date is empty or only partly typed.
 */
export const customRangeError = (
  from: string,
  to: string,
  today: string,
): RangeError => {
  if (!isValidDay(from) || !isValidDay(to)) return 'analyticsRangeIncomplete';
  if (from < MIN_ANALYTICS_DAY || to < MIN_ANALYTICS_DAY || to > today) {
    return 'analyticsRangeOutOfBounds';
  }
  if (from > to) return 'analyticsInvalidRange';
  if (rangeDays(from, to) > MAX_RANGE_DAYS) return 'analyticsRangeTooLong';
  return null;
};

export default function AnalyticsControls({
  choice,
  from,
  to,
  appliedFrom,
  appliedTo,
  today,
  granularity,
  onPreset,
  onCustomRange,
  onCustom,
  onGranularity,
}: Props) {
  const t = useTranslations();
  const [draft, setDraft] = useState({ from, to });

  // Follow the applied range (a preset click) while the inputs are hidden.
  useEffect(() => {
    if (choice !== 'custom') setDraft({ from, to });
  }, [choice, from, to]);

  const error =
    choice === 'custom' ? customRangeError(draft.from, draft.to, today) : null;

  const changeDraft = (next: { from: string; to: string }) => {
    setDraft(next);
    if (customRangeError(next.from, next.to, today) == null) {
      onCustomRange(next.from, next.to);
    }
  };

  // Both rows pick dates in a way, so each says what it controls.
  const rowLabel = (key: string) => (
    <Typography
      fontSize={13}
      fontWeight={600}
      color={muted}
      className={fontClassName.className}
      aria-hidden
    >
      {t(key)}
    </Typography>
  );

  const dateInputProps = (testId: string) => ({
    min: MIN_ANALYTICS_DAY,
    max: today,
    'data-testid': testId,
  });
  const appliedLabel = (
    <Typography
      fontSize={13}
      color={muted}
      className={fontClassName.className}
      data-testid="analytics-range"
    >
      {`${formatDay(appliedFrom)} – ${formatDay(appliedTo)}`}
    </Typography>
  );
  // In custom mode the inputs show the dates; the label only adds the range
  // the charts were widened to.
  const customWidened =
    error == null && (appliedFrom !== draft.from || appliedTo !== draft.to);

  return (
    <Box className="flex flex-col gap-3">
      <Box
        role="group"
        aria-label={t('analyticsRangeLabel')}
        className="flex flex-row flex-wrap items-center gap-2"
      >
        {rowLabel('analyticsRangeLabel')}
        {([...RANGE_PRESETS, 'custom'] as RangeChoice[]).map((value) => {
          const selected = value === choice;
          return (
            <Chip
              key={value}
              label={t(PRESET_LABEL_KEYS[value])}
              clickable
              aria-pressed={selected}
              onClick={() =>
                value === 'custom' ? onCustom() : onPreset(value)
              }
              className={fontClassName.className}
              sx={{
                fontWeight: 600,
                color: selected ? '#fff' : navy,
                backgroundColor: selected ? navy : '#fff',
                border: `1px solid ${navy}`,
                '&:hover': {
                  backgroundColor: selected ? navy : 'rgba(32, 22, 110, 0.08)',
                },
              }}
            />
          );
        })}
      </Box>

      <Box className="flex flex-row flex-wrap items-center gap-3">
        {choice === 'custom' ? (
          <>
            <TextField
              type="date"
              size="small"
              label={t('analyticsFrom')}
              value={draft.from}
              onChange={(event) =>
                changeDraft({ ...draft, from: event.target.value })
              }
              InputLabelProps={{ shrink: true }}
              inputProps={dateInputProps('analytics-from')}
              error={error != null}
              sx={{ width: 160 }}
            />
            <TextField
              type="date"
              size="small"
              label={t('analyticsTo')}
              value={draft.to}
              onChange={(event) =>
                changeDraft({ ...draft, to: event.target.value })
              }
              InputLabelProps={{ shrink: true }}
              inputProps={dateInputProps('analytics-to')}
              error={error != null}
              sx={{ width: 160 }}
            />
            {customWidened && appliedLabel}
          </>
        ) : (
          appliedLabel
        )}

        <Box
          className="flex flex-row items-center gap-2"
          sx={{ ml: { sm: 'auto' } }}
        >
          {rowLabel('analyticsGranularityLabel')}
          <ToggleButtonGroup
            exclusive
            size="small"
            value={granularity}
            aria-label={t('analyticsGranularityLabel')}
            onChange={(_event, value: Granularity | null) => {
              if (value) onGranularity(value);
            }}
          >
            {GRANULARITIES.map((value) => (
              <ToggleButton
                key={value}
                value={value}
                className={fontClassName.className}
                sx={{ textTransform: 'none', px: 1.5, py: 0.5 }}
              >
                {t(GRANULARITY_LABEL_KEYS[value])}
              </ToggleButton>
            ))}
          </ToggleButtonGroup>
        </Box>
      </Box>

      {error && (
        <Typography fontSize={13} color="error" role="alert">
          {error === 'analyticsRangeOutOfBounds'
            ? t(error, {
                min: formatDay(MIN_ANALYTICS_DAY),
                max: formatDay(today),
              })
            : t(error)}
        </Typography>
      )}
    </Box>
  );
}
