import { Chip } from '@mui/material';
import { UserOrderStatus } from '@prisma/client';
import { CheckCircle2, Clock, Truck, XCircle } from 'lucide-react';
import { useTranslations } from 'next-intl';

interface OrderStatusBadgeProps {
  status: UserOrderStatus;
}

const statusIcons: Record<UserOrderStatus, React.ElementType> = {
  PENDING: Clock,
  IN_PROGRESS: Truck,
  COMPLETED: CheckCircle2,
  USER_CANCELLED: XCircle,
  ADMIN_CANCELLED: XCircle,
};

const statusStyles: Record<UserOrderStatus, { bg: string; color: string }> = {
  PENDING: { bg: '#F3F2F8', color: '#4A4959' },
  IN_PROGRESS: { bg: '#F0EEF9', color: '#20166E' },
  COMPLETED: { bg: '#E7F4EC', color: '#1F8A5B' },
  USER_CANCELLED: { bg: '#FDECEE', color: '#E41E2B' },
  ADMIN_CANCELLED: { bg: '#FDECEE', color: '#E41E2B' },
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

  const { bg, color } = statusStyles[status];
  const Icon = statusIcons[status];

  return (
    <Chip
      label={statusLabels[status]}
      icon={<Icon size={12} color={color} />}
      size="small"
      sx={{
        backgroundColor: bg,
        color,
        fontSize: '11px',
        fontWeight: 700,
        '& .MuiChip-icon': { marginLeft: '10px' },
        '& .MuiChip-label': { padding: '0 10px 0 4px' },
      }}
    />
  );
}
