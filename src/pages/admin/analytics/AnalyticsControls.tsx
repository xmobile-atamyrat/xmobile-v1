import {
  GRANULARITIES,
  MAX_RANGE_DAYS,
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
  from: string;
  to: string;
  granularity: Granularity;
  onPreset: (preset: RangePreset) => void;
  /** Called with a valid custom range only. */
  onCustomRange: (from: string, to: string) => void;
  onCustom: () => void;
  onGranularity: (granularity: Granularity) => void;
};

type RangeError = 'analyticsInvalidRange' | 'analyticsRangeTooLong' | null;

export const customRangeError = (from: string, to: string): RangeError => {
  if (!isValidDay(from) || !isValidDay(to) || from > to) {
    return 'analyticsInvalidRange';
  }
  if (rangeDays(from, to) > MAX_RANGE_DAYS) return 'analyticsRangeTooLong';
  return null;
};

export default function AnalyticsControls({
  choice,
  from,
  to,
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
    choice === 'custom' ? customRangeError(draft.from, draft.to) : null;

  const changeDraft = (next: { from: string; to: string }) => {
    setDraft(next);
    if (customRangeError(next.from, next.to) == null) {
      onCustomRange(next.from, next.to);
    }
  };

  return (
    <Box className="flex flex-col gap-3">
      <Box
        role="group"
        aria-label={t('analyticsRangeLabel')}
        className="flex flex-row flex-wrap gap-2"
      >
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
              inputProps={{ 'data-testid': 'analytics-from' }}
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
              inputProps={{ 'data-testid': 'analytics-to' }}
              error={error != null}
              sx={{ width: 160 }}
            />
          </>
        ) : (
          <Typography
            fontSize={13}
            color={muted}
            className={fontClassName.className}
            data-testid="analytics-range"
          >
            {`${formatDay(from)} – ${formatDay(to)}`}
          </Typography>
        )}

        <ToggleButtonGroup
          exclusive
          size="small"
          value={granularity}
          aria-label={t('analyticsGranularityLabel')}
          onChange={(_event, value: Granularity | null) => {
            if (value) onGranularity(value);
          }}
          sx={{ ml: { sm: 'auto' } }}
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

      {error && (
        <Typography fontSize={13} color="error" role="alert">
          {t(error)}
        </Typography>
      )}
    </Box>
  );
}
