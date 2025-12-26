import Layout from '@/pages/components/Layout';
import { appBarHeight, mobileAppBarHeight } from '@/pages/lib/constants';
import { useFetchWithCreds } from '@/pages/lib/fetch';
import { usePlatform } from '@/pages/lib/PlatformContext';
import { SnackbarProps } from '@/pages/lib/types';
import { useUserContext } from '@/pages/lib/UserContext';
import { parseName } from '@/pages/lib/utils';
import { interClassname } from '@/styles/theme';
import ArrowBackIosIcon from '@mui/icons-material/ArrowBackIos';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  IconButton,
  Snackbar,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import { UserOrder } from '@prisma/client';
import { GetServerSideProps } from 'next';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import CancelOrderDialog from './components/CancelOrderDialog';
import OrderStatusBadge from './components/OrderStatusBadge';
import { cancelUserOrder, getUserOrderDetail } from './lib/apiUtils';

export const getServerSideProps: GetServerSideProps = async (context) => {
  return {
    props: {
      messages: (await import(`../../i18n/${context.locale}.json`)).default,
    },
  };
};

export default function OrderDetailPage() {
  const router = useRouter();
  const { id } = router.query;
  const { user, accessToken } = useUserContext();
  const fetchWithCreds = useFetchWithCreds();
  const t = useTranslations();
  const platform = usePlatform();

  const [order, setOrder] = useState<
    | (UserOrder & {
        items: Array<{
          id: string;
          quantity: number;
          productName: string;
          productPrice: string;
        }>;
      })
    | null
  >(null);
  const [loading, setLoading] = useState(true);
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState<SnackbarProps>();
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);

  const formatDate = (date: Date | string | null | undefined) => {
    if (!date) return '-';
    const d = new Date(date);
    if (platform === 'mobile') {
      return d.toLocaleDateString('en-GB', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
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

  const fetchOrder = async () => {
    if (!accessToken || !id || typeof id !== 'string') return;

    setLoading(true);
    try {
      const result = await getUserOrderDetail({
        accessToken,
        orderId: id,
        fetchWithCreds,
      });

      if (result.success && result.data) {
        setOrder(result.data as typeof order);
      } else {
        setSnackbarOpen(true);
        setSnackbarMessage({
          message: result.message || 'fetchOrderError',
          severity: 'error',
        });
      }
    } catch (error) {
      console.error('Error fetching order:', error);
      setSnackbarOpen(true);
      setSnackbarMessage({
        message: 'fetchOrderError',
        severity: 'error',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!user) {
      router.push('/user/profile');
      return;
    }

    if (id) {
      fetchOrder();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, accessToken, id]);

  const handleCancelOrder = async (cancellationReason?: string) => {
    if (!accessToken || !id || typeof id !== 'string') return;

    try {
      const result = await cancelUserOrder({
        accessToken,
        orderId: id,
        cancellationReason,
        fetchWithCreds,
      });

      if (result.success && result.data) {
        setOrder(result.data as typeof order);
        setSnackbarOpen(true);
        setSnackbarMessage({
          message: 'orderCancelled',
          severity: 'success',
        });
      } else {
        setSnackbarOpen(true);
        setSnackbarMessage({
          message: result.message || 'cancelOrderError',
          severity: 'error',
        });
      }
    } catch (error) {
      console.error('Error cancelling order:', error);
      setSnackbarOpen(true);
      setSnackbarMessage({
        message: 'cancelOrderError',
        severity: 'error',
      });
    }
  };

  const canCancelOrder = () => {
    if (!order) return false;
    return (
      order.status !== 'COMPLETED' &&
      order.status !== 'USER_CANCELLED' &&
      order.status !== 'ADMIN_CANCELLED'
    );
  };

  const handleBackButton = () => {
    if (platform === 'mobile') {
      router.push('/user/profile');
    } else {
      router.push('/orders');
    }
  };

  if (loading) {
    return (
      <Layout handleHeaderBackButton={handleBackButton}>
        <Box
          sx={{
            mt:
              platform === 'web'
                ? `${appBarHeight}px`
                : `${mobileAppBarHeight}px`,
            p: platform === 'web' ? 2 : 1,
          }}
          className="flex justify-center items-center py-12"
        >
          <CircularProgress />
        </Box>
      </Layout>
    );
  }

  if (!order) {
    return (
      <Layout handleHeaderBackButton={handleBackButton}>
        <Box
          sx={{
            mt:
              platform === 'web'
                ? `${appBarHeight}px`
                : `${mobileAppBarHeight}px`,
            p: platform === 'web' ? 2 : 1,
          }}
          className="flex justify-center items-center py-12"
        >
          <Typography className={interClassname.className}>
            {t('noOrdersFound')}
          </Typography>
        </Box>
      </Layout>
    );
  }

  return (
    <Layout handleHeaderBackButton={handleBackButton}>
      <Box
        sx={{
          mt:
            platform === 'web'
              ? `${appBarHeight}px`
              : `${mobileAppBarHeight}px`,
          p: platform === 'web' ? 2 : 1,
        }}
        className="flex flex-col w-full px-4 py-4"
      >
        {/* Header */}
        <Box className="flex items-center gap-4 mb-4">
          {platform === 'mobile' && (
            <IconButton onClick={handleBackButton}>
              <ArrowBackIosIcon />
            </IconButton>
          )}
          <Box className="flex-1">
            <Typography
              className={`${interClassname.className} text-2xl font-semibold mb-2`}
            >
              {order.orderNumber}
            </Typography>
            <OrderStatusBadge status={order.status} />
          </Box>
          {canCancelOrder() && (
            <Button
              variant="outlined"
              color="error"
              onClick={() => setCancelDialogOpen(true)}
              sx={{ textTransform: 'none' }}
            >
              {t('cancelOrder')}
            </Button>
          )}
        </Box>

        {/* Delivery Information */}
        <Box className="mb-6">
          <Typography
            className={`${interClassname.className} text-lg font-semibold mb-3`}
          >
            {t('delivery')}
          </Typography>
          <Box className="space-y-2">
            <Box>
              <Typography
                className={`${interClassname.className} text-sm text-gray-600`}
              >
                {t('deliveryAddress')}:
              </Typography>
              <Typography className={interClassname.className}>
                {order.deliveryAddress}
              </Typography>
            </Box>
            <Box>
              <Typography
                className={`${interClassname.className} text-sm text-gray-600`}
              >
                {t('deliveryPhone')}:
              </Typography>
              <Typography className={interClassname.className}>
                {order.deliveryPhone}
              </Typography>
            </Box>
            {order.notes && (
              <Box>
                <Typography
                  className={`${interClassname.className} text-sm text-gray-600`}
                >
                  {t('notes')}:
                </Typography>
                <Typography className={interClassname.className}>
                  {order.notes}
                </Typography>
              </Box>
            )}
          </Box>
        </Box>

        {/* Order Items */}
        <Box className="mb-6">
          <Typography
            className={`${interClassname.className} text-lg font-semibold mb-3`}
          >
            {t('orderItems')}
          </Typography>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>
                    <Typography
                      className={interClassname.className}
                      fontWeight={600}
                    >
                      {t('product')}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography
                      className={interClassname.className}
                      fontWeight={600}
                    >
                      {t('quantity')}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography
                      className={interClassname.className}
                      fontWeight={600}
                    >
                      {t('price')}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography
                      className={interClassname.className}
                      fontWeight={600}
                    >
                      {t('subtotal')}
                    </Typography>
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {order.items.map((item) => {
                  const itemPrice = parseFloat(item.productPrice) || 0;
                  const subtotal = itemPrice * item.quantity;
                  return (
                    <TableRow key={item.id}>
                      <TableCell>
                        <Typography className={interClassname.className}>
                          {parseName(item.productName, router.locale ?? 'tk')}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography className={interClassname.className}>
                          {item.quantity}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography className={interClassname.className}>
                          {parseFloat(item.productPrice).toFixed(2)} TMT
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography className={interClassname.className}>
                          {subtotal.toFixed(2)} TMT
                        </Typography>
                      </TableCell>
                    </TableRow>
                  );
                })}
                <TableRow>
                  <TableCell colSpan={3}>
                    <Typography
                      className={interClassname.className}
                      fontWeight={600}
                    >
                      {t('orderTotal')}:
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography
                      className={interClassname.className}
                      fontWeight={600}
                    >
                      {parseFloat(order.totalPrice).toFixed(2)} TMT
                    </Typography>
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </TableContainer>
        </Box>

        {/* Order Metadata */}
        <Box className="mb-6">
          <Typography
            className={`${interClassname.className} text-lg font-semibold mb-3`}
          >
            {t('information')}
          </Typography>
          <Box className="space-y-2">
            <Box>
              <Typography
                className={`${interClassname.className} text-sm text-gray-600`}
              >
                {t('createdAt')}:
              </Typography>
              <Typography className={interClassname.className}>
                {formatDate(order.createdAt)}
              </Typography>
            </Box>
            {order.completedAt && (
              <Box>
                <Typography
                  className={`${interClassname.className} text-sm text-gray-600`}
                >
                  {t('completedAt')}:
                </Typography>
                <Typography className={interClassname.className}>
                  {formatDate(order.completedAt)}
                </Typography>
              </Box>
            )}
            {order.cancelledAt && (
              <Box>
                <Typography
                  className={`${interClassname.className} text-sm text-gray-600`}
                >
                  {t('cancelledAt')}:
                </Typography>
                <Typography className={interClassname.className}>
                  {formatDate(order.cancelledAt)}
                </Typography>
              </Box>
            )}
            {order.cancellationReason && (
              <Box>
                <Typography
                  className={`${interClassname.className} text-sm text-gray-600`}
                >
                  {t('cancellationReason')}:
                </Typography>
                <Typography className={interClassname.className}>
                  {order.cancellationReason}
                </Typography>
              </Box>
            )}
          </Box>
        </Box>
      </Box>

      {/* Cancel Order Dialog */}
      <CancelOrderDialog
        open={cancelDialogOpen}
        onClose={() => setCancelDialogOpen(false)}
        onConfirm={handleCancelOrder}
      />

      {/* Snackbar */}
      <Snackbar
        open={snackbarOpen}
        autoHideDuration={6000}
        onClose={() => setSnackbarOpen(false)}
      >
        <Alert
          onClose={() => setSnackbarOpen(false)}
          severity={snackbarMessage?.severity}
          variant="filled"
        >
          {snackbarMessage?.message && t(snackbarMessage.message)}
        </Alert>
      </Snackbar>
    </Layout>
  );
}
