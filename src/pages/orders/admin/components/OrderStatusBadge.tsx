import { Chip } from '@mui/material';
import { UserOrderStatus } from '@prisma/client';
import { useTranslations } from 'next-intl';

interface OrderStatusBadgeProps {
  status: UserOrderStatus;
}

const statusColors: Record<
  UserOrderStatus,
  'default' | 'primary' | 'success' | 'error' | 'warning'
> = {
  PENDING: 'default',
  IN_PROGRESS: 'primary',
  COMPLETED: 'success',
  USER_CANCELLED: 'error',
  ADMIN_CANCELLED: 'warning',
};

const statusBgColors: Record<UserOrderStatus, string> = {
  PENDING: '#9e9e9e',
  IN_PROGRESS: '#1976d2',
  COMPLETED: '#2e7d32',
  USER_CANCELLED: '#d32f2f',
  ADMIN_CANCELLED: '#ed6c02',
};

export default function OrderStatusBadge({ status }: OrderStatusBadgeProps) {
  const t = useTranslations();

  const statusLabels: Record<UserOrderStatus, string> = {
    PENDING: t('pending'),
    IN_PROGRESS: t('inProgress'),
    COMPLETED: t('completed'),
    USER_CANCELLED: t('userCancelled'),
    ADMIN_CANCELLED: t('adminCancelled'),
  };

  return (
    <Chip
      label={statusLabels[status]}
      color={statusColors[status]}
      sx={{
        backgroundColor: statusBgColors[status],
        color: 'white',
        fontWeight: 600,
      }}
      size="small"
    />
  );
}
