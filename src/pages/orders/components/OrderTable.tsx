import { usePlatform } from '@/pages/lib/PlatformContext';
import { interClassname } from '@/styles/theme';
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import { UserOrder } from '@prisma/client';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/router';
import OrderStatusBadge from './OrderStatusBadge';

interface OrderTableProps {
  orders: UserOrder[];
}

export default function OrderTable({ orders }: OrderTableProps) {
  const router = useRouter();
  const t = useTranslations();
  const platform = usePlatform();

  const formatDate = (date: Date | string) => {
    const d = new Date(date);
    return d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (platform === 'mobile') {
    return null; // Use OrderCard for mobile
  }

  return (
    <TableContainer>
      <Table>
        <TableHead>
          <TableRow>
            <TableCell>
              <Typography className={interClassname.className} fontWeight={600}>
                {t('orderNumber')}
              </Typography>
            </TableCell>
            <TableCell>
              <Typography className={interClassname.className} fontWeight={600}>
                {t('deliveryAddress')}
              </Typography>
            </TableCell>
            <TableCell>
              <Typography className={interClassname.className} fontWeight={600}>
                {t('orderStatus')}
              </Typography>
            </TableCell>
            <TableCell>
              <Typography className={interClassname.className} fontWeight={600}>
                {t('orderTotal')}
              </Typography>
            </TableCell>
            <TableCell>
              <Typography className={interClassname.className} fontWeight={600}>
                {t('createdAt')}
              </Typography>
            </TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {orders.map((order) => (
            <TableRow
              key={order.id}
              sx={{
                cursor: 'pointer',
                '&:hover': { backgroundColor: '#f5f5f5' },
              }}
              onClick={() => router.push(`/orders/${order.id}`)}
            >
              <TableCell>
                <Typography className={interClassname.className}>
                  {order.orderNumber}
                </Typography>
              </TableCell>
              <TableCell>
                <Typography className={interClassname.className}>
                  {order.deliveryAddress}
                </Typography>
              </TableCell>
              <TableCell>
                <OrderStatusBadge status={order.status} />
              </TableCell>
              <TableCell>
                <Typography className={interClassname.className}>
                  {parseFloat(order.totalPrice).toFixed(2)} TMT
                </Typography>
              </TableCell>
              <TableCell>
                <Typography className={interClassname.className}>
                  {formatDate(order.createdAt)}
                </Typography>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}
