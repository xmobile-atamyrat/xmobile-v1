import { usePlatform } from '@/pages/lib/PlatformContext';
import { userOrdersIndexClasses } from '@/styles/classMaps/userOrders';
import { interClassname } from '@/styles/theme';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import {
  Box,
  Button,
  Collapse,
  IconButton,
  MenuItem,
  Select,
  TextField,
  Typography,
} from '@mui/material';
import { UserOrderStatus } from '@prisma/client';
import { useTranslations } from 'next-intl';
import { useState } from 'react';

interface OrderFiltersProps {
  status?: UserOrderStatus;
  searchKeyword?: string;
  dateFrom?: string;
  dateTo?: string;
  onStatusChange: (status: UserOrderStatus | undefined) => void;
  onSearchKeywordChange: (searchKeyword: string) => void;
  onDateFromChange: (date: string) => void;
  onDateToChange: (date: string) => void;
  onClear: () => void;
}

export default function OrderFilters({
  status,
  searchKeyword,
  dateFrom,
  dateTo,
  onStatusChange,
  onSearchKeywordChange,
  onDateFromChange,
  onDateToChange,
  onClear,
}: OrderFiltersProps) {
  const t = useTranslations();
  const platform = usePlatform();
  const [filtersOpen, setFiltersOpen] = useState(platform === 'web');

  const getDefaultDateFrom = () => {
    const date = new Date();
    date.setDate(date.getDate() - 30);
    return date.toISOString().split('T')[0];
  };

  const getDefaultDateTo = () => {
    return new Date().toISOString().split('T')[0];
  };

  return (
    <Box className={userOrdersIndexClasses.filtersContainer[platform]}>
      {platform === 'mobile' && (
        <Box className="flex flex-row justify-between items-center mb-2">
          <Typography className={interClassname.className} fontWeight={600}>
            {t('filterOrders')}
          </Typography>
          <IconButton onClick={() => setFiltersOpen(!filtersOpen)} size="small">
            {filtersOpen ? <ExpandLessIcon /> : <ExpandMoreIcon />}
          </IconButton>
        </Box>
      )}
      <Collapse in={filtersOpen}>
        <Box className={userOrdersIndexClasses.filtersBox[platform]}>
          <Select
            value={status || ''}
            onChange={(e) =>
              onStatusChange(
                e.target.value
                  ? (e.target.value as UserOrderStatus)
                  : undefined,
              )
            }
            displayEmpty
            className={userOrdersIndexClasses.filterField[platform]}
            size="small"
          >
            <MenuItem value="">{t('allOrders')}</MenuItem>
            <MenuItem value="PENDING">{t('pending')}</MenuItem>
            <MenuItem value="IN_PROGRESS">{t('inProgress')}</MenuItem>
            <MenuItem value="COMPLETED">{t('completed')}</MenuItem>
            <MenuItem value="USER_CANCELLED">{t('userCancelled')}</MenuItem>
            <MenuItem value="ADMIN_CANCELLED">{t('adminCancelled')}</MenuItem>
          </Select>

          <TextField
            label={t('searchCustomer')}
            value={searchKeyword || ''}
            onChange={(e) => onSearchKeywordChange(e.target.value)}
            className={userOrdersIndexClasses.filterField[platform]}
            size="small"
            placeholder={t('searchCustomerPlaceholder')}
          />

          <TextField
            label={t('dateFrom')}
            type="date"
            value={dateFrom || getDefaultDateFrom()}
            onChange={(e) => onDateFromChange(e.target.value)}
            className={userOrdersIndexClasses.filterField[platform]}
            size="small"
            InputLabelProps={{
              shrink: true,
            }}
          />

          <TextField
            label={t('dateTo')}
            type="date"
            value={dateTo || getDefaultDateTo()}
            onChange={(e) => onDateToChange(e.target.value)}
            className={userOrdersIndexClasses.filterField[platform]}
            size="small"
            InputLabelProps={{
              shrink: true,
            }}
          />

          <Button
            variant="outlined"
            onClick={onClear}
            sx={{ textTransform: 'none' }}
            size="small"
            className={platform === 'mobile' ? 'w-full' : ''}
          >
            {t('clearFilters')}
          </Button>
        </Box>
      </Collapse>
    </Box>
  );
}
