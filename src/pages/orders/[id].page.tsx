import Layout from '@/pages/components/Layout';
import { appBarHeight, mobileAppBarHeight } from '@/pages/lib/constants';
import { useFetchWithCreds } from '@/pages/lib/fetch';
import { usePlatform } from '@/pages/lib/PlatformContext';
import { SnackbarProps } from '@/pages/lib/types';
import { useUserContext } from '@/pages/lib/UserContext';
import { parseName } from '@/pages/lib/utils';
import { ordersDetailClasses } from '@/styles/classMaps/orders/detail';
import { interClassname } from '@/styles/theme';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import ArrowBackIosIcon from '@mui/icons-material/ArrowBackIos';
import ArrowForwardIosIcon from '@mui/icons-material/ArrowForwardIos';
import CancelIcon from '@mui/icons-material/Cancel';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogContent,
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

const DELIVERY_FEE = 20; // Fixed delivery fee in TMT

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
  const [itemsDialogOpen, setItemsDialogOpen] = useState(false);

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

  const getStatusIcon = () => {
    if (platform !== 'mobile') return null;

    if (
      order.status === 'USER_CANCELLED' ||
      order.status === 'ADMIN_CANCELLED'
    ) {
      return (
        <Box
          className={ordersDetailClasses.statusIcon.mobile}
          sx={{ backgroundColor: '#ff3b30' }}
        >
          <CancelIcon sx={{ fontSize: '16px', color: 'white' }} />
        </Box>
      );
    }

    if (order.status === 'PENDING' || order.status === 'IN_PROGRESS') {
      return (
        <Box
          className={ordersDetailClasses.statusIcon.mobile}
          sx={{ backgroundColor: '#dcdde2' }}
        >
          <AccessTimeIcon sx={{ fontSize: '16px', color: '#24292f' }} />
        </Box>
      );
    }

    return null;
  };

  const calculateSubtotal = () => {
    return order.items.reduce((sum, item) => {
      const price = parseFloat(item.productPrice) || 0;
      return sum + price * item.quantity;
    }, 0);
  };

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
        className={ordersDetailClasses.container[platform]}
      >
        {/* Header - Mobile */}
        {platform === 'mobile' ? (
          <Box className={ordersDetailClasses.header.mobile}>
            <IconButton onClick={handleBackButton} sx={{ p: 0 }}>
              <ArrowBackIosIcon sx={{ fontSize: '24px' }} />
            </IconButton>
            <Typography
              className={`${interClassname.className} ${ordersDetailClasses.orderNumber.mobile}`}
            >
              {t('order')} {order.orderNumber}
            </Typography>
            {getStatusIcon()}
          </Box>
        ) : (
          <Box className={ordersDetailClasses.header.web}>
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
        )}

        {/* Ordered Items Section - Mobile Only */}
        {platform === 'mobile' && (
          <Box
            className={ordersDetailClasses.orderedItemsSection.mobile}
            onClick={() => setItemsDialogOpen(true)}
          >
            <Typography
              className={`${interClassname.className} ${ordersDetailClasses.orderedItemsText.mobile}`}
            >
              {t('orderedItems')} ({order.items.length})
            </Typography>
            <ArrowForwardIosIcon sx={{ fontSize: '32px', color: '#1c1b1b' }} />
          </Box>
        )}

        {/* Address Section - Mobile */}
        {platform === 'mobile' ? (
          <Box className={ordersDetailClasses.addressSection.mobile}>
            <Typography
              className={`${interClassname.className} ${ordersDetailClasses.addressTitle.mobile}`}
            >
              {t('addressText')}
            </Typography>
            <Box className="flex flex-col gap-0">
              <Box className={ordersDetailClasses.addressRow.mobile}>
                <Typography
                  className={`${interClassname.className} ${ordersDetailClasses.addressLabel.mobile}`}
                >
                  {t('fullName')}
                </Typography>
                <Typography
                  className={`${interClassname.className} ${ordersDetailClasses.addressValue.mobile}`}
                >
                  {order.userName || '-'}
                </Typography>
              </Box>
              <Box className={ordersDetailClasses.addressRow.mobile}>
                <Typography
                  className={`${interClassname.className} ${ordersDetailClasses.addressLabel.mobile}`}
                >
                  {t('phoneNumber')}
                </Typography>
                <Typography
                  className={`${interClassname.className} ${ordersDetailClasses.addressValue.mobile}`}
                >
                  {order.deliveryPhone}
                </Typography>
              </Box>
              <Box className={ordersDetailClasses.addressRow.mobile}>
                <Typography
                  className={`${interClassname.className} ${ordersDetailClasses.addressLabel.mobile}`}
                >
                  {t('city')}
                </Typography>
                <Typography
                  className={`${interClassname.className} ${ordersDetailClasses.addressValue.mobile}`}
                >
                  {t('cityPlaceholder')}
                </Typography>
              </Box>
              <Box className={ordersDetailClasses.addressRow.mobile}>
                <Typography
                  className={`${interClassname.className} ${ordersDetailClasses.addressLabel.mobile}`}
                >
                  {t('addressText')}
                </Typography>
                <Typography
                  className={`${interClassname.className} ${ordersDetailClasses.addressValue.mobile}`}
                >
                  {order.deliveryAddress}
                </Typography>
              </Box>
              <Box className={ordersDetailClasses.addressRow.mobile}>
                <Typography
                  className={`${interClassname.className} ${ordersDetailClasses.addressLabel.mobile}`}
                >
                  {t('streetAddress')}
                </Typography>
                <Typography
                  className={`${interClassname.className} ${ordersDetailClasses.addressValue.mobile}`}
                >
                  {order.deliveryAddress}
                </Typography>
              </Box>
            </Box>
          </Box>
        ) : (
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
        )}

        {/* Order Items - Web Only */}
        {platform === 'web' && (
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
        )}

        {/* Order Info Section - Mobile */}
        {platform === 'mobile' && (
          <Box className={ordersDetailClasses.orderInfoSection.mobile}>
            <Typography
              className={`${interClassname.className} ${ordersDetailClasses.orderInfoTitle.mobile}`}
            >
              {t('orderInfo')}
            </Typography>
            <Box className="flex flex-col gap-0">
              <Box className={ordersDetailClasses.orderInfoRow.mobile}>
                <Typography
                  className={`${interClassname.className} ${ordersDetailClasses.addressLabel.mobile}`}
                >
                  {t('subtotal')}
                </Typography>
                <Typography
                  className={`${interClassname.className} ${ordersDetailClasses.addressValue.mobile}`}
                >
                  {calculateSubtotal().toFixed(2)} TMT
                </Typography>
              </Box>
              <Box className={ordersDetailClasses.orderInfoRow.mobile}>
                <Typography
                  className={`${interClassname.className} ${ordersDetailClasses.addressLabel.mobile}`}
                >
                  {t('deliveryFee')}
                </Typography>
                <Typography
                  className={`${interClassname.className} ${ordersDetailClasses.addressValue.mobile}`}
                >
                  {DELIVERY_FEE.toFixed(2)} TMT
                </Typography>
              </Box>
              <Box className={ordersDetailClasses.orderInfoTotal.mobile}>
                <Typography
                  className={`${interClassname.className} ${ordersDetailClasses.orderInfoTotalLabel.mobile}`}
                >
                  {t('totalAmount')}
                </Typography>
                <Typography
                  className={`${interClassname.className} ${ordersDetailClasses.orderInfoTotalValue.mobile}`}
                >
                  {parseFloat(order.totalPrice).toFixed(2)} TMT
                </Typography>
              </Box>
            </Box>
          </Box>
        )}

        {/* Order Metadata - Web Only */}
        {platform === 'web' && (
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
        )}

        {/* Cancel Button - Mobile Only */}
        {platform === 'mobile' && canCancelOrder() && (
          <Button
            className={`${interClassname.className} ${ordersDetailClasses.cancelButton.mobile}`}
            onClick={() => setCancelDialogOpen(true)}
            sx={{
              '&:hover': {
                backgroundColor: '#c5c6cb',
              },
            }}
          >
            {t('cancelTheOrder')}
          </Button>
        )}
      </Box>

      {/* Order Items Dialog - Mobile */}
      {platform === 'mobile' && (
        <Dialog
          open={itemsDialogOpen}
          onClose={() => setItemsDialogOpen(false)}
          fullWidth
          maxWidth="sm"
        >
          <DialogContent>
            <Typography
              className={`${interClassname.className} text-lg font-semibold mb-4`}
            >
              {t('orderedItems')} ({order.items.length})
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
                </TableBody>
              </Table>
            </TableContainer>
          </DialogContent>
        </Dialog>
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
