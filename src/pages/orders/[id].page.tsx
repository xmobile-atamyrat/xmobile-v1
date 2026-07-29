import Layout from '@/pages/components/Layout';
import { OrderDetailSkeleton } from '@/pages/components/SkeletonLoader';
import VariantBadge from '@/pages/components/VariantBadge';
import { appBarHeight, mobileAppBarHeight } from '@/pages/lib/constants';
import { parseOrderVariant } from '@/pages/product/utils';
import { fetchWithoutCreds, useFetchWithCreds } from '@/pages/lib/fetch';
import { useNotificationContext } from '@/pages/lib/NotificationContext';
import { usePlatform } from '@/pages/lib/PlatformContext';
import { SnackbarProps } from '@/pages/lib/types';
import { useUserContext } from '@/pages/lib/UserContext';
import { parseName } from '@/pages/lib/utils';
import { formatDate } from '@/pages/orders/lib/utils';
import { ordersDetailClasses } from '@/styles/classMaps/orders/detail';
import { fontClassName } from '@/styles/theme';
import { ArrowLeft, Banknote, MapPin } from 'lucide-react';
import {
  Alert,
  Box,
  Button,
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
          selectedVariant?: string | null;
        }>;
      })
    | null
  >(null);
  const [loading, setLoading] = useState(true);
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState<SnackbarProps>();
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const { notifications, markAsRead } = useNotificationContext();

  const fetchOrder = async () => {
    if (!id || typeof id !== 'string') return;

    setLoading(true);
    try {
      const result = user
        ? await getUserOrderDetail({
            accessToken,
            orderId: id,
            fetchWithCreds,
          })
        : await fetchWithoutCreds<typeof order>(
            `/api/guest/order/${id}`,
            'GET',
          );

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
    // Redirect admins to admin order detail page
    if (user && (user.grade === 'ADMIN' || user.grade === 'SUPERUSER')) {
      if (id && typeof id === 'string') {
        router.push(`/orders/admin/${id}`);
      }
      return;
    }

    if (id) {
      fetchOrder();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, accessToken, id, router]);

  // Mark order notifications as read when they come from deeplink
  useEffect(() => {
    if (id && typeof id === 'string' && notifications.length > 0) {
      const orderNotifications = notifications.filter(
        (notification) => notification.orderId === id && !notification.isRead,
      );
      if (orderNotifications.length > 0) {
        markAsRead(
          orderNotifications.map((notification) => notification.id),
        ).catch((error) => {
          console.error('Failed to mark order notifications as read:', error);
        });
      }
    }
  }, [id, notifications, markAsRead]);

  const handleCancelOrder = async (cancellationReason?: string) => {
    if (!id || typeof id !== 'string') return;

    try {
      const result = user
        ? await cancelUserOrder({
            accessToken,
            orderId: id,
            cancellationReason,
            fetchWithCreds,
          })
        : await fetchWithoutCreds<UserOrder>(
            `/api/guest/order/${id}?action=cancel`,
            'PUT',
            {
              cancellationReason,
            },
          );

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
    router.push('/orders');
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
          }}
        >
          <OrderDetailSkeleton />
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
          <Typography className={fontClassName.className}>
            {t('noOrdersFound')}
          </Typography>
        </Box>
      </Layout>
    );
  }

  return (
    <Layout handleHeaderBackButton={handleBackButton}>
      {platform === 'mobile' ? (
        <Box className={ordersDetailClasses.container.mobile}>
          {/* Header */}
          <Box className={ordersDetailClasses.header.mobile}>
            <button
              type="button"
              onClick={handleBackButton}
              className={ordersDetailClasses.backButton.mobile}
              aria-label="back"
            >
              <ArrowLeft size={20} color="#20166E" />
            </button>
            <Box className="flex-1">
              <Typography
                className={`${fontClassName.className} ${ordersDetailClasses.headerTitle.mobile}`}
              >
                {t('orderDetails')}
              </Typography>
              <Typography
                className={`${fontClassName.className} ${ordersDetailClasses.headerOrderNumber.mobile}`}
              >
                {order.orderNumber}
              </Typography>
            </Box>
          </Box>

          <Box className={ordersDetailClasses.content.mobile}>
            {/* Status */}
            <Box className={ordersDetailClasses.card.mobile}>
              <Box className={ordersDetailClasses.statusRow.mobile}>
                <OrderStatusBadge status={order.status} />
                <Typography
                  className={`${fontClassName.className} ${ordersDetailClasses.statusDate.mobile}`}
                >
                  {formatDate(order.createdAt, platform)}
                </Typography>
              </Box>
              {order.cancellationReason && (
                <Typography
                  className={`${fontClassName.className} ${ordersDetailClasses.infoText.mobile} mt-2`}
                >
                  {order.cancellationReason}
                </Typography>
              )}
            </Box>

            {/* Items */}
            <Box className={ordersDetailClasses.card.mobile}>
              <Typography
                className={`${fontClassName.className} ${ordersDetailClasses.cardLabel.mobile}`}
              >
                {t('orderedItems')} ({order.items?.length})
              </Typography>
              {order.items?.map((item) => {
                const subtotal =
                  (parseFloat(item.productPrice) || 0) * item.quantity;
                return (
                  <Box
                    key={item.id}
                    className={ordersDetailClasses.itemRow.mobile}
                  >
                    <Box className="flex-1">
                      <Typography
                        className={`${fontClassName.className} ${ordersDetailClasses.itemName.mobile}`}
                      >
                        {parseName(item.productName, router.locale ?? 'tk')}
                      </Typography>
                      <Box className={ordersDetailClasses.itemMeta.mobile}>
                        {item.selectedVariant && (
                          <VariantBadge
                            {...parseOrderVariant(item.selectedVariant)}
                          />
                        )}
                        <span>×{item.quantity}</span>
                      </Box>
                    </Box>
                    <Typography
                      className={`${fontClassName.className} ${ordersDetailClasses.itemPrice.mobile}`}
                    >
                      {subtotal.toFixed(2)} TMT
                    </Typography>
                  </Box>
                );
              })}
            </Box>

            {/* Total */}
            <Box className={ordersDetailClasses.card.mobile}>
              <Box className={ordersDetailClasses.totalRow.mobile}>
                <Typography
                  className={`${fontClassName.className} ${ordersDetailClasses.totalLabel.mobile}`}
                >
                  {t('orderTotal')}
                </Typography>
                <Typography
                  className={`${fontClassName.className} ${ordersDetailClasses.totalValue.mobile}`}
                >
                  {parseFloat(order.totalPrice).toFixed(2)} TMT
                </Typography>
              </Box>
            </Box>

            {/* Delivery + payment */}
            <Box className={ordersDetailClasses.card.mobile}>
              <Box className={ordersDetailClasses.infoRow.mobile}>
                <MapPin
                  size={18}
                  color="#20166E"
                  className="flex-none mt-[2px]"
                />
                <Box>
                  <Typography
                    className={`${fontClassName.className} ${ordersDetailClasses.infoTitle.mobile}`}
                  >
                    {order.userName || t('deliverTo')}
                  </Typography>
                  <Typography
                    className={`${fontClassName.className} ${ordersDetailClasses.infoText.mobile}`}
                  >
                    {order.deliveryAddress}
                  </Typography>
                  <Typography
                    className={`${fontClassName.className} ${ordersDetailClasses.infoText.mobile}`}
                  >
                    {order.deliveryPhone}
                  </Typography>
                </Box>
              </Box>
              <Box className={ordersDetailClasses.infoRow.mobile}>
                <Banknote
                  size={18}
                  color="#1F8A5B"
                  className="flex-none mt-[2px]"
                />
                <Box>
                  <Typography
                    className={`${fontClassName.className} ${ordersDetailClasses.infoTitle.mobile}`}
                  >
                    {t('cashOnDelivery')}
                  </Typography>
                  <Typography
                    className={`${fontClassName.className} ${ordersDetailClasses.infoText.mobile}`}
                  >
                    {parseFloat(order.totalPrice).toFixed(2)} TMT
                  </Typography>
                </Box>
              </Box>
            </Box>

            {canCancelOrder() && (
              <Button
                className={`${fontClassName.className} ${ordersDetailClasses.cancelButton.mobile}`}
                onClick={() => setCancelDialogOpen(true)}
              >
                {t('cancelTheOrder')}
              </Button>
            )}
          </Box>
        </Box>
      ) : (
        <Box className={ordersDetailClasses.container.web}>
          {/* Header - Web */}
          <Box className={ordersDetailClasses.header.web}>
            <Box className="flex-1">
              <Typography
                className={`${fontClassName.className} text-2xl font-semibold mb-2`}
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

          {/* Delivery - Web */}
          <Box className="mb-6">
            <Typography
              className={`${fontClassName.className} text-lg font-semibold mb-3`}
            >
              {t('delivery')}
            </Typography>
            <Box className="space-y-2">
              <Box>
                <Typography
                  className={`${fontClassName.className} text-sm text-gray-600`}
                >
                  {t('deliveryAddress')}:
                </Typography>
                <Typography className={fontClassName.className}>
                  {order.deliveryAddress}
                </Typography>
              </Box>
              <Box>
                <Typography
                  className={`${fontClassName.className} text-sm text-gray-600`}
                >
                  {t('deliveryPhone')}:
                </Typography>
                <Typography className={fontClassName.className}>
                  {order.deliveryPhone}
                </Typography>
              </Box>
              {order.notes && (
                <Box>
                  <Typography
                    className={`${fontClassName.className} text-sm text-gray-600`}
                  >
                    {t('notes')}:
                  </Typography>
                  <Typography className={fontClassName.className}>
                    {order.notes}
                  </Typography>
                </Box>
              )}
            </Box>
          </Box>

          {/* Order Items - Web */}
          <Box className="mb-6">
            <Typography
              className={`${fontClassName.className} text-lg font-semibold mb-3`}
            >
              {t('orderItems')}
            </Typography>
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>
                      <Typography
                        className={fontClassName.className}
                        fontWeight={600}
                      >
                        {t('product')}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography
                        className={fontClassName.className}
                        fontWeight={600}
                      >
                        {t('quantity')}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography
                        className={fontClassName.className}
                        fontWeight={600}
                      >
                        {t('price')}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography
                        className={fontClassName.className}
                        fontWeight={600}
                      >
                        {t('subtotal')}
                      </Typography>
                    </TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {order.items?.map((item) => {
                    const itemPrice = parseFloat(item.productPrice) || 0;
                    const subtotal = itemPrice * item.quantity;
                    return (
                      <TableRow key={item.id}>
                        <TableCell>
                          <Typography className={fontClassName.className}>
                            {parseName(item.productName, router.locale ?? 'tk')}
                          </Typography>
                          {item.selectedVariant && (
                            <VariantBadge
                              {...parseOrderVariant(item.selectedVariant)}
                            />
                          )}
                        </TableCell>
                        <TableCell>
                          <Typography className={fontClassName.className}>
                            {item.quantity}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography className={fontClassName.className}>
                            {parseFloat(item.productPrice).toFixed(2)} TMT
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography className={fontClassName.className}>
                            {subtotal.toFixed(2)} TMT
                          </Typography>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  <TableRow>
                    <TableCell colSpan={3}>
                      <Typography
                        className={fontClassName.className}
                        fontWeight={600}
                      >
                        {t('orderTotal')}:
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography
                        className={fontClassName.className}
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

          {/* Order Metadata - Web */}
          <Box className="mb-6">
            <Typography
              className={`${fontClassName.className} text-lg font-semibold mb-3`}
            >
              {t('information')}
            </Typography>
            <Box className="space-y-2">
              <Box>
                <Typography
                  className={`${fontClassName.className} text-sm text-gray-600`}
                >
                  {t('createdAt')}:
                </Typography>
                <Typography className={fontClassName.className}>
                  {formatDate(order.createdAt, platform)}
                </Typography>
              </Box>
              {order.completedAt && (
                <Box>
                  <Typography
                    className={`${fontClassName.className} text-sm text-gray-600`}
                  >
                    {t('completedAt')}:
                  </Typography>
                  <Typography className={fontClassName.className}>
                    {formatDate(order.completedAt, platform)}
                  </Typography>
                </Box>
              )}
              {order.cancelledAt && (
                <Box>
                  <Typography
                    className={`${fontClassName.className} text-sm text-gray-600`}
                  >
                    {t('cancelledAt')}:
                  </Typography>
                  <Typography className={fontClassName.className}>
                    {formatDate(order.cancelledAt, platform)}
                  </Typography>
                </Box>
              )}
              {order.cancellationReason && (
                <Box>
                  <Typography
                    className={`${fontClassName.className} text-sm text-gray-600`}
                  >
                    {t('cancellationReason')}:
                  </Typography>
                  <Typography className={fontClassName.className}>
                    {order.cancellationReason}
                  </Typography>
                </Box>
              )}
            </Box>
          </Box>
        </Box>
      )}

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
