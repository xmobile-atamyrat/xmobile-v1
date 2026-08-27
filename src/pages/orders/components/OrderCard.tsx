import { usePlatform } from '@/pages/lib/PlatformContext';
import { ordersComponentClasses } from '@/styles/classMaps/orders/components';
import { fontClassName } from '@/styles/theme';
import { Box, Typography } from '@mui/material';
import { UserOrder } from '@prisma/client';
import { ChevronRight } from 'lucide-react';
import { useRouter } from 'next/router';
import OrderStatusBadge from './OrderStatusBadge';

interface OrderCardProps {
  order: UserOrder;
}

export default function OrderCard({ order }: OrderCardProps) {
  const router = useRouter();
  const platform = usePlatform();

  const formatDate = (date: Date | string) => {
    const d = new Date(date);
    return d.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (platform !== 'mobile') {
    return null;
  }

  return (
    <Box
      className={ordersComponentClasses.orderCard.mobile}
      onClick={() => router.push(`/orders/${order.id}`)}
    >
      <Box className={ordersComponentClasses.orderCardHeader.mobile}>
        <Typography
          className={`${fontClassName.className} ${ordersComponentClasses.orderCardNumber.mobile}`}
        >
          #{order.orderNumber}
        </Typography>
        <OrderStatusBadge status={order.status} />
      </Box>
      <Typography
        className={`${fontClassName.className} ${ordersComponentClasses.orderCardName.mobile}`}
      >
        {order.userName || 'N/A'}{' '}
        <span
          className={`${fontClassName.className} ${ordersComponentClasses.orderCardPhone.mobile}`}
        >
          · {order.deliveryPhone}
        </span>
      </Typography>
      <Typography
        className={`${fontClassName.className} ${ordersComponentClasses.orderCardAddress.mobile}`}
      >
        {order.deliveryAddress}
      </Typography>
      <Box className={ordersComponentClasses.orderCardFooter.mobile}>
        <Typography
          className={`${fontClassName.className} ${ordersComponentClasses.orderCardDate.mobile}`}
        >
          {formatDate(order.createdAt)}
        </Typography>
        <Box className="flex items-center gap-2">
          <Typography
            className={`${fontClassName.className} ${ordersComponentClasses.orderCardPrice.mobile}`}
          >
            {parseFloat(order.totalPrice).toFixed(2)} TMT
          </Typography>
          <ChevronRight size={18} color="#8B8A98" />
        </Box>
      </Box>
    </Box>
  );
}
