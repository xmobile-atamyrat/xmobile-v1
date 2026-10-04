import {
  formatActivityDay,
  HeatmapCell,
  HeatmapDay,
  heatmapGrid,
} from '@/pages/lib/adminActivity';
import { fontClassName, hairline, muted, navy } from '@/styles/theme';
import { Box, Typography } from '@mui/material';
import { useTranslations } from 'next-intl';
import { useMemo } from 'react';

const LEVEL_COLORS = [hairline, '#C9C5E8', '#9A93D4', '#5B50B0', navy];
const CELL = 12;
const GAP = 3;

type Props = {
  name: string;
  from: string;
  to: string;
  days: HeatmapDay[];
  selectedDay: string | undefined;
  onSelectDay: (day: string | undefined) => void;
};

export default function ActivityHeatmap({
  name,
  from,
  to,
  days,
  selectedDay,
  onSelectDay,
}: Props) {
  const t = useTranslations();
  const weeks = useMemo(() => heatmapGrid(days, from, to), [days, from, to]);

  // Month numbers above the column a month starts in: numerals read the same in
  // every locale, so no month-name tables are needed.
  const monthLabel = (week: (HeatmapCell | null)[], index: number) => {
    const first = week.find((cell) => cell != null)?.date;
    if (!first) return '';
    const [, month, day] = first.split('-');
    return index === 0 || Number(day) <= 7 ? month : '';
  };

  const tip = (cell: HeatmapCell) =>
    t('activityHeatmapTip', {
      date: formatActivityDay(cell.date),
      changes: cell.changes,
      chats: cell.chats,
    });

  return (
    <Box className="flex flex-col gap-2">
      <Typography fontWeight={600} className={fontClassName.className}>
        {t('activityHeatmapTitle', { name })}
      </Typography>

      <Box sx={{ overflowX: 'auto', pb: 1 }}>
        <Box
          sx={{
            display: 'grid',
            gridAutoFlow: 'column',
            gridTemplateRows: `14px repeat(7, ${CELL}px)`,
            gridAutoColumns: `${CELL}px`,
            gap: `${GAP}px`,
            width: 'max-content',
          }}
        >
          {weeks.map((week, index) => (
            <Box
              key={week.find((cell) => cell != null)?.date ?? index}
              sx={{ display: 'contents' }}
            >
              <Typography
                component="span"
                sx={{ fontSize: 10, lineHeight: '14px', color: muted }}
              >
                {monthLabel(week, index)}
              </Typography>
              {week.map((cell, row) =>
                cell == null ? (
                  // eslint-disable-next-line react/no-array-index-key
                  <Box key={`pad-${index}-${row}`} />
                ) : (
                  <Box
                    key={cell.date}
                    component="button"
                    type="button"
                    onClick={() =>
                      onSelectDay(
                        selectedDay === cell.date ? undefined : cell.date,
                      )
                    }
                    title={tip(cell)}
                    aria-label={tip(cell)}
                    aria-pressed={selectedDay === cell.date}
                    sx={{
                      width: CELL,
                      height: CELL,
                      p: 0,
                      border: 0,
                      borderRadius: '3px',
                      cursor: 'pointer',
                      backgroundColor: LEVEL_COLORS[cell.level],
                      outline:
                        selectedDay === cell.date
                          ? `2px solid ${navy}`
                          : 'none',
                      outlineOffset: 1,
                    }}
                  />
                ),
              )}
            </Box>
          ))}
        </Box>
      </Box>

      <Box className="flex flex-row flex-wrap items-center justify-between gap-2">
        <Typography
          fontSize={12}
          color={muted}
          className={fontClassName.className}
        >
          {t('activityHeatmapHint')}
        </Typography>
        <Box className="flex flex-row items-center gap-1">
          <Typography
            fontSize={12}
            color={muted}
            className={fontClassName.className}
          >
            {t('activityHeatmapLess')}
          </Typography>
          {LEVEL_COLORS.map((color) => (
            <Box
              key={color}
              aria-hidden
              sx={{
                width: CELL,
                height: CELL,
                borderRadius: '3px',
                backgroundColor: color,
              }}
            />
          ))}
          <Typography
            fontSize={12}
            color={muted}
            className={fontClassName.className}
          >
            {t('activityHeatmapMore')}
          </Typography>
        </Box>
      </Box>
    </Box>
  );
}
