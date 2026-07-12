import { usePlatform } from '@/pages/lib/PlatformContext';
import { fontClassName } from '@/styles/theme';
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
    <TableContainer
      sx={{
        backgroundColor: '#fff',
        border: '1px solid #ECECF1',
        borderRadius: '16px',
      }}
    >
      <Table>
        <TableHead>
          <TableRow>
            <TableCell sx={{ borderColor: '#ECECF1' }}>
              <Typography
                className={fontClassName.className}
                fontWeight={600}
                color="#17161D"
              >
                {t('orderNumber')}
              </Typography>
            </TableCell>
            <TableCell sx={{ borderColor: '#ECECF1' }}>
              <Typography
                className={fontClassName.className}
                fontWeight={600}
                color="#17161D"
              >
                {t('deliveryAddress')}
              </Typography>
            </TableCell>
            <TableCell sx={{ borderColor: '#ECECF1' }}>
              <Typography
                className={fontClassName.className}
                fontWeight={600}
                color="#17161D"
              >
                {t('orderStatus')}
              </Typography>
            </TableCell>
            <TableCell sx={{ borderColor: '#ECECF1' }}>
              <Typography
                className={fontClassName.className}
                fontWeight={600}
                color="#17161D"
              >
                {t('orderTotal')}
              </Typography>
            </TableCell>
            <TableCell sx={{ borderColor: '#ECECF1' }}>
              <Typography
                className={fontClassName.className}
                fontWeight={600}
                color="#17161D"
              >
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
                '&:hover': { backgroundColor: '#F5F5F8' },
                '& .MuiTableCell-root': { borderColor: '#ECECF1' },
              }}
              onClick={() => router.push(`/orders/${order.id}`)}
            >
              <TableCell>
                <Typography className={fontClassName.className} color="#17161D">
                  {order.orderNumber}
                </Typography>
              </TableCell>
              <TableCell>
                <Typography className={fontClassName.className} color="#4A4959">
                  {order.deliveryAddress}
                </Typography>
              </TableCell>
              <TableCell>
                <OrderStatusBadge status={order.status} />
              </TableCell>
              <TableCell>
                <Typography
                  className={fontClassName.className}
                  fontWeight={700}
                  color="#20166E"
                >
                  {parseFloat(order.totalPrice).toFixed(2)} TMT
                </Typography>
              </TableCell>
              <TableCell>
                <Typography className={fontClassName.className} color="#8B8A98">
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
