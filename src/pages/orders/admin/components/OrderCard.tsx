import { usePlatform } from '@/pages/lib/PlatformContext';
import { userOrdersComponentClasses } from '@/styles/classMaps/userOrders/components';
import { interClassname } from '@/styles/theme';
import { Box, Typography } from '@mui/material';
import { UserOrder } from '@prisma/client';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/router';
import OrderStatusBadge from './OrderStatusBadge';

interface OrderCardProps {
  order: UserOrder & {
    user?: {
      name: string;
      phoneNumber: string | null;
    };
  };
}

export default function OrderCard({ order }: OrderCardProps) {
  const router = useRouter();
  const t = useTranslations();
  const platform = usePlatform();

  const formatDate = (date: Date | string) => {
    const d = new Date(date);
    if (platform === 'mobile') {
      return d.toLocaleDateString('en-GB', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      });
    }
    return d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <Box
      className={userOrdersComponentClasses.orderCard[platform]}
      onClick={() => router.push(`/orders/admin/${order.id}`)}
    >
      <Box className="flex flex-row justify-between items-start mb-2">
        <Typography className={`${interClassname.className} font-bold text-lg`}>
          {order.orderNumber}
        </Typography>
        <OrderStatusBadge status={order.status} />
      </Box>
      {order.user && (
        <Box className="mb-2">
          <Typography
            className={`${interClassname.className} text-sm text-gray-600`}
          >
            {t('userName')}: {order.user.name}
          </Typography>
          {order.user.phoneNumber && (
            <Typography
              className={`${interClassname.className} text-sm text-gray-600`}
            >
              {t('userPhone')}: {order.user.phoneNumber}
            </Typography>
          )}
        </Box>
      )}
      <Box className="flex flex-row justify-between items-center">
        <Typography className={`${interClassname.className} font-semibold`}>
          {order.totalPrice} TMT
        </Typography>
        <Typography
          className={`${interClassname.className} text-sm text-gray-500`}
        >
          {formatDate(order.createdAt)}
        </Typography>
      </Box>
    </Box>
  );
}
