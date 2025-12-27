import { usePlatform } from '@/pages/lib/PlatformContext';
import { interClassname } from '@/styles/theme';
import { Box, MenuItem, Select, TextField, Typography } from '@mui/material';
import { UserOrderStatus } from '@prisma/client';
import { useTranslations } from 'next-intl';

interface OrderFiltersProps {
  status?: UserOrderStatus;
  dateFrom?: string;
  dateTo?: string;
  onStatusChange: (status: UserOrderStatus | undefined) => void;
  onDateFromChange: (date: string) => void;
  onDateToChange: (date: string) => void;
  onClear: () => void;
}

export default function OrderFilters({
  status,
  dateFrom,
  dateTo,
  onStatusChange,
  onDateFromChange,
  onDateToChange,
}: OrderFiltersProps) {
  const t = useTranslations();
  const platform = usePlatform();

  if (platform === 'mobile') {
    return null; // Tabs are used on mobile instead
  }

  return (
    <Box className="flex flex-row gap-4 items-end mb-6">
      <Box className="min-w-[200px]">
        <Typography
          className={`${interClassname.className} mb-2`}
          variant="body2"
        >
          {t('orderStatus')}
        </Typography>
        <Select
          value={status || ''}
          onChange={(e) =>
            onStatusChange(
              e.target.value ? (e.target.value as UserOrderStatus) : undefined,
            )
          }
          displayEmpty
          fullWidth
          sx={{
            backgroundColor: 'white',
            borderRadius: '10px',
          }}
        >
          <MenuItem value="">{t('allOrders')}</MenuItem>
          <MenuItem value="PENDING">{t('pending')}</MenuItem>
          <MenuItem value="IN_PROGRESS">{t('inProgress')}</MenuItem>
          <MenuItem value="COMPLETED">{t('completed')}</MenuItem>
          <MenuItem value="USER_CANCELLED">{t('userCancelled')}</MenuItem>
          <MenuItem value="ADMIN_CANCELLED">{t('adminCancelled')}</MenuItem>
        </Select>
      </Box>
      <Box className="min-w-[200px]">
        <Typography
          className={`${interClassname.className} mb-2`}
          variant="body2"
        >
          {t('dateFrom')}
        </Typography>
        <TextField
          type="date"
          value={dateFrom || ''}
          onChange={(e) => onDateFromChange(e.target.value)}
          fullWidth
          sx={{
            backgroundColor: 'white',
            borderRadius: '10px',
            '& .MuiOutlinedInput-root': {
              borderRadius: '10px',
            },
          }}
        />
      </Box>
      <Box className="min-w-[200px]">
        <Typography
          className={`${interClassname.className} mb-2`}
          variant="body2"
        >
          {t('dateTo')}
        </Typography>
        <TextField
          type="date"
          value={dateTo || ''}
          onChange={(e) => onDateToChange(e.target.value)}
          fullWidth
          sx={{
            backgroundColor: 'white',
            borderRadius: '10px',
            '& .MuiOutlinedInput-root': {
              borderRadius: '10px',
            },
          }}
        />
      </Box>
    </Box>
  );
}
