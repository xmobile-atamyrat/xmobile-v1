import {
  ACTIVITY_ACTION_LABEL_KEYS,
  ACTIVITY_ACTIONS,
  ACTIVITY_ENTITIES,
  ACTIVITY_ENTITY_LABEL_KEYS,
  ActivityAction,
  ActivityEntity,
  ActivityRow,
  activitySentence,
  formatActivityTime,
  StaffMember,
  Translate,
} from '@/pages/lib/adminActivity';
import { colors, fontClassName, hairline, muted } from '@/styles/theme';
import {
  Box,
  Button,
  CircularProgress,
  MenuItem,
  TextField,
  Typography,
} from '@mui/material';
import { useTranslations } from 'next-intl';

export type ActivityFilters = {
  userId?: string;
  entity?: ActivityEntity;
  action?: ActivityAction;
  from?: string;
  to?: string;
};

type Props = {
  staff: StaffMember[];
  filters: ActivityFilters;
  onFiltersChange: (filters: ActivityFilters) => void;
  items: ActivityRow[];
  loading: boolean;
  hasMore: boolean;
  onLoadMore: () => void;
};

const ALL = '';

export default function ActivityFeed({
  staff,
  filters,
  onFiltersChange,
  items,
  loading,
  hasMore,
  onLoadMore,
}: Props) {
  const t = useTranslations();
  const translate = t as unknown as Translate;

  const set = (patch: Partial<ActivityFilters>) =>
    onFiltersChange({ ...filters, ...patch });
  const hasFilters = Object.values(filters).some((value) => value != null);

  return (
    <Box className="flex flex-col gap-3">
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
          gap: 1.5,
        }}
      >
        <TextField
          select
          size="small"
          label={t('activityFilterAdmin')}
          value={filters.userId ?? ALL}
          onChange={(event) => set({ userId: event.target.value || undefined })}
        >
          <MenuItem value={ALL}>{t('activityAllAdmins')}</MenuItem>
          {staff.map((member) => (
            <MenuItem key={member.id} value={member.id}>
              {member.name}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          select
          size="small"
          label={t('activityFilterEntity')}
          value={filters.entity ?? ALL}
          onChange={(event) =>
            set({ entity: (event.target.value as ActivityEntity) || undefined })
          }
        >
          <MenuItem value={ALL}>{t('activityAllEntities')}</MenuItem>
          {ACTIVITY_ENTITIES.map((entity) => (
            <MenuItem key={entity} value={entity}>
              {t(ACTIVITY_ENTITY_LABEL_KEYS[entity])}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          select
          size="small"
          label={t('activityFilterAction')}
          value={filters.action ?? ALL}
          onChange={(event) =>
            set({ action: (event.target.value as ActivityAction) || undefined })
          }
        >
          <MenuItem value={ALL}>{t('activityAllActions')}</MenuItem>
          {ACTIVITY_ACTIONS.map((action) => (
            <MenuItem key={action} value={action}>
              {t(ACTIVITY_ACTION_LABEL_KEYS[action])}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          type="date"
          size="small"
          label={t('activityFilterFrom')}
          value={filters.from ?? ''}
          onChange={(event) => set({ from: event.target.value || undefined })}
          InputLabelProps={{ shrink: true }}
        />
        <TextField
          type="date"
          size="small"
          label={t('activityFilterTo')}
          value={filters.to ?? ''}
          onChange={(event) => set({ to: event.target.value || undefined })}
          InputLabelProps={{ shrink: true }}
        />
      </Box>

      {hasFilters && (
        <Box>
          <Button
            size="small"
            onClick={() => onFiltersChange({})}
            sx={{ textTransform: 'none', color: colors.main }}
          >
            {t('clearFilters')}
          </Button>
        </Box>
      )}

      <Box
        component="ul"
        sx={{
          listStyle: 'none',
          m: 0,
          p: 0,
          backgroundColor: '#fff',
          borderRadius: '14px',
          border: `1px solid ${hairline}`,
        }}
      >
        {items.map((row) => (
          <Box
            component="li"
            key={row.id}
            sx={{
              p: 2,
              display: 'flex',
              flexDirection: 'column',
              gap: 0.5,
              '&:not(:last-child)': { borderBottom: `1px solid ${hairline}` },
            }}
          >
            <Typography
              fontSize={12}
              color={muted}
              className={fontClassName.className}
            >
              {formatActivityTime(row.createdAt)}
            </Typography>
            <Typography fontSize={15} className={fontClassName.className}>
              <Box component="span" sx={{ fontWeight: 700 }}>
                {row.userName}
              </Box>
              {row.userId == null && (
                <Box component="span" sx={{ color: muted }}>
                  {` (${t('activityRemovedAccount')})`}
                </Box>
              )}
              {` ${activitySentence(row, translate)}`}
            </Typography>
          </Box>
        ))}
        {!loading && items.length === 0 && (
          <Box component="li" sx={{ p: 3, textAlign: 'center', color: muted }}>
            {t('activityEmpty')}
          </Box>
        )}
      </Box>

      <Box className="flex flex-row justify-center">
        {loading ? (
          <CircularProgress size={24} />
        ) : (
          hasMore && (
            <Button
              variant="outlined"
              onClick={onLoadMore}
              sx={{ textTransform: 'none', color: colors.main }}
            >
              {t('showMore')}
            </Button>
          )
        )}
      </Box>
    </Box>
  );
}
