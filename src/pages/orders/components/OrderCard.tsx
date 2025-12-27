import { usePlatform } from '@/pages/lib/PlatformContext';
import { ordersComponentClasses } from '@/styles/classMaps/orders/components';
import { interClassname } from '@/styles/theme';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import ArrowForwardIosIcon from '@mui/icons-material/ArrowForwardIos';
import CancelIcon from '@mui/icons-material/Cancel';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import { Box, Typography } from '@mui/material';
import { UserOrder, UserOrderStatus } from '@prisma/client';
import { useRouter } from 'next/router';

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

  const getStatusIcon = (status: UserOrderStatus) => {
    switch (status) {
      case 'PENDING':
      case 'IN_PROGRESS':
        return (
          <Box
            className={ordersComponentClasses.orderCardStatusIcon.mobile}
            sx={{ backgroundColor: '#dcdde2' }}
          >
            <AccessTimeIcon sx={{ fontSize: '16px', color: '#24292f' }} />
          </Box>
        );
      case 'COMPLETED':
        return (
          <Box
            className={ordersComponentClasses.orderCardStatusIcon.mobile}
            sx={{ backgroundColor: '#2e7d32' }}
          >
            <CheckCircleIcon sx={{ fontSize: '16px', color: 'white' }} />
          </Box>
        );
      case 'USER_CANCELLED':
      case 'ADMIN_CANCELLED':
        return (
          <Box
            className={ordersComponentClasses.orderCardStatusIcon.mobile}
            sx={{ backgroundColor: '#ff3b30' }}
          >
            <CancelIcon sx={{ fontSize: '16px', color: 'white' }} />
          </Box>
        );
      default:
        return null;
    }
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
        <Box>
          <Typography
            className={`${interClassname.className} ${ordersComponentClasses.orderCardName.mobile}`}
          >
            {order.userName || 'N/A'} |{' '}
            <span
              className={`${interClassname.className} ${ordersComponentClasses.orderCardPhone.mobile}`}
            >
              {order.deliveryPhone}
            </span>
          </Typography>
        </Box>
        {getStatusIcon(order.status)}
      </Box>
      <Typography
        className={`${interClassname.className} ${ordersComponentClasses.orderCardAddress.mobile}`}
      >
        {order.deliveryAddress}
      </Typography>
      <Box className={ordersComponentClasses.orderCardFooter.mobile}>
        <Typography
          className={`${interClassname.className} ${ordersComponentClasses.orderCardDate.mobile}`}
        >
          {formatDate(order.createdAt)}
        </Typography>
        <Box className="flex items-center gap-2">
          <Typography
            className={`${interClassname.className} ${ordersComponentClasses.orderCardPrice.mobile}`}
          >
            {parseFloat(order.totalPrice).toFixed(2)} TMT
          </Typography>
          <ArrowForwardIosIcon
            className={ordersComponentClasses.orderCardArrow.mobile}
            sx={{ fontSize: '17px', color: '#24292f' }}
          />
        </Box>
      </Box>
    </Box>
  );
}
