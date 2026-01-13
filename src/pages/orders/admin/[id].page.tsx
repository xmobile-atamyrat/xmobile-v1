import Layout from '@/pages/components/Layout';
import { appBarHeight, mobileAppBarHeight } from '@/pages/lib/constants';
import { useFetchWithCreds } from '@/pages/lib/fetch';
import { usePlatform } from '@/pages/lib/PlatformContext';
import { SnackbarProps } from '@/pages/lib/types';
import { useUserContext } from '@/pages/lib/UserContext';
import { parseName } from '@/pages/lib/utils';
import { userOrdersDetailClasses } from '@/styles/classMaps/userOrders';
import { interClassname } from '@/styles/theme';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Snackbar,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import { Product, UserOrder, UserOrderStatus } from '@prisma/client';
import { GetServerSideProps } from 'next';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import OrderStatusBadge from './components/OrderStatusBadge';
import UpdateNotesDialog from './components/UpdateNotesDialog';
import UpdateStatusDialog from './components/UpdateStatusDialog';
import {
  getOrderDetail,
  updateAdminNotes,
  updateOrderStatus,
} from './lib/apiUtils';

export const getServerSideProps: GetServerSideProps = async (context) => {
  return {
    props: {
      messages: (await import(`../../../i18n/${context.locale}.json`)).default,
    },
  };
};

export default function UserOrderDetailPage() {
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
          productId: string;
          productPrice: string;
          selectedTag?: string | null;
          product?: Product;
        }>;
        user?: {
          name: string;
          email: string;
          phoneNumber: string | null;
          address: string | null;
        } | null;
      })
    | null
  >(null);
  const [loading, setLoading] = useState(true);
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState<SnackbarProps>();
  const [statusDialogOpen, setStatusDialogOpen] = useState(false);
  const [notesDialogOpen, setNotesDialogOpen] = useState(false);

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
      const result = await getOrderDetail({
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
      return;
    }

    if (!['ADMIN', 'SUPERUSER'].includes(user.grade)) {
      router.push('/');
      return;
    }

    if (id) {
      fetchOrder();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, accessToken, id]);

  const handleStatusUpdate = async (
    status: UserOrderStatus,
    adminNotes?: string,
    cancellationReason?: string,
  ) => {
    if (!accessToken || !id || typeof id !== 'string' || !order) return;

    const updated = await updateOrderStatus({
      accessToken,
      orderId: id,
      status,
      adminNotes,
      cancellationReason,
      fetchWithCreds,
      setSnackbarMessage,
      setSnackbarOpen,
    });

    if (updated) {
      // Refetch to get full order with items
      await fetchOrder();
    }
  };

  const handleNotesUpdate = async (adminNotes: string) => {
    if (!accessToken || !id || typeof id !== 'string' || !order) return;

    const updated = await updateAdminNotes({
      accessToken,
      orderId: id,
      adminNotes,
      fetchWithCreds,
      setSnackbarMessage,
      setSnackbarOpen,
    });

    if (updated) {
      // Refetch to get full order with items
      await fetchOrder();
    }
  };

  if (loading) {
    return (
      <Layout handleHeaderBackButton={() => router.push('/orders/admin')}>
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
      <Layout handleHeaderBackButton={() => router.push('/orders/admin')}>
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
    <Layout handleHeaderBackButton={() => router.push('/orders/admin')}>
      {['ADMIN', 'SUPERUSER'].includes(user?.grade) && (
        <Box
          sx={{
            mt:
              platform === 'web'
                ? `${appBarHeight}px`
                : `${mobileAppBarHeight}px`,
            p: platform === 'web' ? 2 : 1,
          }}
          className={userOrdersDetailClasses.box[platform]}
        >
          <Box className={userOrdersDetailClasses.header[platform]}>
            <Box>
              <Typography
                className={`${interClassname.className} ${userOrdersDetailClasses.orderNumber[platform]}`}
              >
                {order.orderNumber}
              </Typography>
              <Box className="mt-2">
                <OrderStatusBadge status={order.status} />
              </Box>
            </Box>
            <Box className={userOrdersDetailClasses.actionButtons[platform]}>
              <Button
                variant="outlined"
                onClick={() => setStatusDialogOpen(true)}
                sx={{ textTransform: 'none' }}
              >
                {t('updateStatus')}
              </Button>
              <Button
                variant="outlined"
                onClick={() => setNotesDialogOpen(true)}
                sx={{ textTransform: 'none' }}
              >
                {t('updateNotes')}
              </Button>
            </Box>
          </Box>

          {/* Customer Information */}
          <Box className={userOrdersDetailClasses.section[platform]}>
            <Typography
              className={`${interClassname.className} ${userOrdersDetailClasses.sectionTitle[platform]}`}
            >
              {t('customerInfo')}
            </Typography>
            {order.user && (
              <Box className={userOrdersDetailClasses.infoRowBox[platform]}>
                <Box className={userOrdersDetailClasses.infoRow[platform]}>
                  <Typography
                    className={`${interClassname.className} ${userOrdersDetailClasses.infoLabel[platform]}`}
                  >
                    {t('userName')}:
                  </Typography>
                  <Typography
                    className={`${interClassname.className} ${userOrdersDetailClasses.infoValue[platform]}`}
                  >
                    {order.user.name}
                  </Typography>
                </Box>
                <Box className={userOrdersDetailClasses.infoRow[platform]}>
                  <Typography
                    className={`${interClassname.className} ${userOrdersDetailClasses.infoLabel[platform]}`}
                  >
                    {t('userEmail')}:
                  </Typography>
                  <Typography
                    className={`${interClassname.className} ${userOrdersDetailClasses.infoValue[platform]}`}
                  >
                    {order.userEmail || order.user?.email || '-'}
                  </Typography>
                </Box>
                {order.user?.phoneNumber && (
                  <Box className={userOrdersDetailClasses.infoRow[platform]}>
                    <Typography
                      className={`${interClassname.className} ${userOrdersDetailClasses.infoLabel[platform]}`}
                    >
                      {t('userPhone')}:
                    </Typography>
                    <Typography
                      className={`${interClassname.className} ${userOrdersDetailClasses.infoValue[platform]}`}
                    >
                      {order.user.phoneNumber}
                    </Typography>
                  </Box>
                )}
              </Box>
            )}
            <Box className={userOrdersDetailClasses.infoRow[platform]}>
              <Typography
                className={`${interClassname.className} ${userOrdersDetailClasses.infoLabel[platform]}`}
              >
                {t('deliveryAddress')}:
              </Typography>
              <Typography
                className={`${interClassname.className} ${userOrdersDetailClasses.infoValue[platform]}`}
              >
                {order.deliveryAddress}
              </Typography>
            </Box>
            <Box className={userOrdersDetailClasses.infoRow[platform]}>
              <Typography
                className={`${interClassname.className} ${userOrdersDetailClasses.infoLabel[platform]}`}
              >
                {t('deliveryPhone')}:
              </Typography>
              <Typography
                className={`${interClassname.className} ${userOrdersDetailClasses.infoValue[platform]}`}
              >
                {order.deliveryPhone}
              </Typography>
            </Box>
            {order.notes && (
              <Box className={userOrdersDetailClasses.infoRow[platform]}>
                <Typography
                  className={`${interClassname.className} ${userOrdersDetailClasses.infoLabel[platform]}`}
                >
                  {t('notes')}:
                </Typography>
                <Typography
                  className={`${interClassname.className} ${userOrdersDetailClasses.infoValue[platform]}`}
                >
                  {order.notes}
                </Typography>
              </Box>
            )}
          </Box>

          {/* Order Items */}
          <Box className={userOrdersDetailClasses.section[platform]}>
            <Typography
              className={`${interClassname.className} ${userOrdersDetailClasses.sectionTitle[platform]}`}
            >
              {t('orderItems')}
            </Typography>
            <TableContainer
              className={userOrdersDetailClasses.itemsTable[platform]}
            >
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
                          <Typography
                            className={`${interClassname.className} cursor-pointer hover:underline text-blue-600`}
                            onClick={() => {
                              const variantIndex = item.selectedTag
                                ? item.product?.tags.findIndex(
                                    (tag: string) => tag === item.selectedTag,
                                  )
                                : undefined;
                              router.push({
                                pathname: `/product/${item.productId}`,
                                query:
                                  variantIndex !== undefined &&
                                  variantIndex !== -1
                                    ? { v: variantIndex }
                                    : {},
                              });
                            }}
                          >
                            {parseName(item.productName, router.locale ?? 'tk')}
                            {item.selectedTag && (
                              <Typography
                                component="span"
                                className={`${interClassname.className} text-sm text-gray-500 ml-2`}
                              >
                                {item.selectedTag
                                  .replace(/\[.*\]|tmt/gi, '')
                                  .trim()}
                              </Typography>
                            )}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography className={interClassname.className}>
                            {item.quantity}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography className={interClassname.className}>
                            {item.productPrice} TMT
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
                        {order.totalPrice} TMT
                      </Typography>
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </TableContainer>
          </Box>

          {/* Order Metadata */}
          <Box className={userOrdersDetailClasses.section[platform]}>
            <Typography
              className={`${interClassname.className} ${userOrdersDetailClasses.sectionTitle[platform]}`}
            >
              {t('orderStatus')}
            </Typography>
            <Box className={userOrdersDetailClasses.infoRow[platform]}>
              <Typography
                className={`${interClassname.className} ${userOrdersDetailClasses.infoLabel[platform]}`}
              >
                {t('createdAt')}:
              </Typography>
              <Typography
                className={`${interClassname.className} ${userOrdersDetailClasses.infoValue[platform]}`}
              >
                {formatDate(order.createdAt)}
              </Typography>
            </Box>
            <Box className={userOrdersDetailClasses.infoRow[platform]}>
              <Typography
                className={`${interClassname.className} ${userOrdersDetailClasses.infoLabel[platform]}`}
              >
                {t('updatedAt')}:
              </Typography>
              <Typography
                className={`${interClassname.className} ${userOrdersDetailClasses.infoValue[platform]}`}
              >
                {formatDate(order.updatedAt)}
              </Typography>
            </Box>
            {order.cancelledAt && (
              <Box className={userOrdersDetailClasses.infoRow[platform]}>
                <Typography
                  className={`${interClassname.className} ${userOrdersDetailClasses.infoLabel[platform]}`}
                >
                  {t('cancelledAt')}:
                </Typography>
                <Typography
                  className={`${interClassname.className} ${userOrdersDetailClasses.infoValue[platform]}`}
                >
                  {formatDate(order.cancelledAt)}
                </Typography>
              </Box>
            )}
            {order.cancellationReason && (
              <Box className={userOrdersDetailClasses.infoRow[platform]}>
                <Typography
                  className={`${interClassname.className} ${userOrdersDetailClasses.infoLabel[platform]}`}
                >
                  {t('cancellationReason')}:
                </Typography>
                <Typography
                  className={`${interClassname.className} ${userOrdersDetailClasses.infoValue[platform]}`}
                >
                  {order.cancellationReason}
                </Typography>
              </Box>
            )}
            {order.adminNotes && (
              <Box className={userOrdersDetailClasses.infoRow[platform]}>
                <Typography
                  className={`${interClassname.className} ${userOrdersDetailClasses.infoLabel[platform]}`}
                >
                  {t('adminNotes')}:
                </Typography>
                <Typography
                  className={`${interClassname.className} ${userOrdersDetailClasses.infoValue[platform]}`}
                >
                  {order.adminNotes}
                </Typography>
              </Box>
            )}
          </Box>

          <UpdateStatusDialog
            open={statusDialogOpen}
            onClose={() => setStatusDialogOpen(false)}
            onSubmit={handleStatusUpdate}
            currentStatus={order.status}
            currentNotes={order.adminNotes}
          />

          <UpdateNotesDialog
            open={notesDialogOpen}
            onClose={() => setNotesDialogOpen(false)}
            onSubmit={handleNotesUpdate}
            currentNotes={order.adminNotes}
          />

          <Snackbar
            open={snackbarOpen}
            autoHideDuration={6000}
            onClose={(_, reason) => {
              if (reason === 'clickaway') {
                return;
              }
              setSnackbarOpen(false);
            }}
          >
            <Alert
              onClose={() => setSnackbarOpen(false)}
              severity={snackbarMessage?.severity}
              variant="filled"
              sx={{ width: '100%' }}
            >
              {snackbarMessage?.message && t(snackbarMessage.message)}
            </Alert>
          </Snackbar>
        </Box>
      )}
    </Layout>
  );
}
