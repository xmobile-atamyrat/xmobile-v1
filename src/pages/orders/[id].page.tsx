import Layout from '@/pages/components/Layout';
import { OrderDetailSkeleton } from '@/pages/components/SkeletonLoader';
import VariantBadge from '@/pages/components/VariantBadge';
import { appBarHeight } from '@/pages/lib/constants';
import { parseOrderVariant } from '@/pages/product/utils';
import { fetchWithoutCreds, useFetchWithCreds } from '@/pages/lib/fetch';
import { productThumbnailUrl } from '@/pages/lib/mediaUrls';
import {
  deliveryFeeLabel as formatDeliveryFee,
  isPickupOrder,
  MAX_DELIVERY_DAYS,
  orderDeliveryFee,
  orderItemsSubtotal,
  showDeliveryFee,
} from '@/pages/lib/orderDelivery';
import { useNotificationContext } from '@/pages/lib/NotificationContext';
import { usePlatform } from '@/pages/lib/PlatformContext';
import { SnackbarProps } from '@/pages/lib/types';
import { useUserContext } from '@/pages/lib/UserContext';
import { parseName } from '@/pages/lib/utils';
import { formatDate } from '@/pages/orders/lib/utils';
import AccountNav from '@/pages/user/components/AccountNav';
import { ordersDetailClasses } from '@/styles/classMaps/orders/detail';
import { fontClassName } from '@/styles/theme';
import {
  ArrowLeft,
  Banknote,
  MapPin,
  Package,
  StickyNote,
  Store,
} from 'lucide-react';
import {
  Alert,
  Box,
  Button,
  ButtonBase,
  CardMedia,
  Snackbar,
  Typography,
} from '@mui/material';
import { UserOrder } from '@prisma/client';
import { GetServerSideProps } from 'next';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import CancelOrderDialog from './components/CancelOrderDialog';
import OrderStatusBadge from './components/OrderStatusBadge';
import {
  cancelUserOrder,
  getUserOrderDetail,
  UserOrderWithItems,
} from './lib/apiUtils';

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

  const [order, setOrder] = useState<UserOrderWithItems | null>(null);
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

  // The loaded view's header, also shown while loading and on "not found" so
  // mobile always has a way back (the mobile app bar has no back arrow here).
  const mobileHeader = (orderNumber?: string) => (
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
        {orderNumber && (
          <Typography
            className={`${fontClassName.className} ${ordersDetailClasses.headerOrderNumber.mobile}`}
          >
            {orderNumber}
          </Typography>
        )}
      </Box>
    </Box>
  );

  if (loading) {
    return (
      <Layout handleHeaderBackButton={handleBackButton}>
        {platform === 'mobile' ? (
          <Box className={ordersDetailClasses.container.mobile}>
            {mobileHeader()}
            <OrderDetailSkeleton />
          </Box>
        ) : (
          <Box sx={{ mt: `${appBarHeight}px` }}>
            <OrderDetailSkeleton />
          </Box>
        )}
      </Layout>
    );
  }

  if (!order) {
    const notFound = (
      <Typography className={fontClassName.className}>
        {t('noOrdersFound')}
      </Typography>
    );
    return (
      <Layout handleHeaderBackButton={handleBackButton}>
        {platform === 'mobile' ? (
          <Box className={ordersDetailClasses.container.mobile}>
            {mobileHeader()}
            <Box className="flex justify-center items-center py-12 px-2">
              {notFound}
            </Box>
          </Box>
        ) : (
          <Box
            sx={{ mt: `${appBarHeight}px`, p: 2 }}
            className="flex justify-center items-center py-12"
          >
            {notFound}
          </Box>
        )}
      </Layout>
    );
  }

  const items = order.items ?? [];
  // Real numbers only: the line snapshots add up to the subtotal, and the total
  // is the one stored on the order, delivery fee included once an admin sets it.
  const subtotal = orderItemsSubtotal(items);
  const orderTotal = parseFloat(order.totalPrice) || subtotal;
  const isPickup = isPickupOrder(order);
  const deliveryFeeLabel = formatDeliveryFee(order, t);
  const isDeliveryFree = orderDeliveryFee(order) === 0;
  const showDelivery = showDeliveryFee(order);
  const deliveryLines = isPickup
    ? [t('pickupYourself'), t('address')]
    : [
        order.deliveryAddress,
        t('deliveryWithinDays', { days: MAX_DELIVERY_DAYS }),
      ];

  const timeline = [
    { label: t('createdAt'), value: formatDate(order.createdAt, platform) },
    ...(order.completedAt
      ? [
          {
            label: t('completedAt'),
            value: formatDate(order.completedAt, platform),
          },
        ]
      : []),
    ...(order.cancelledAt
      ? [
          {
            label: t('cancelledAt'),
            value: formatDate(order.cancelledAt, platform),
          },
        ]
      : []),
    ...(order.cancellationReason
      ? [{ label: t('cancellationReason'), value: order.cancellationReason }]
      : []),
  ];

  return (
    <Layout handleHeaderBackButton={handleBackButton}>
      {platform === 'mobile' ? (
        <Box className={ordersDetailClasses.container.mobile}>
          {mobileHeader(order.orderNumber)}

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
                const lineTotal =
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
                      {lineTotal.toFixed(2)} TMT
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
                {isPickup ? (
                  <Store
                    size={18}
                    color="#20166E"
                    className="flex-none mt-[2px]"
                  />
                ) : (
                  <MapPin
                    size={18}
                    color="#20166E"
                    className="flex-none mt-[2px]"
                  />
                )}
                <Box>
                  <Typography
                    className={`${fontClassName.className} ${ordersDetailClasses.infoTitle.mobile}`}
                  >
                    {order.userName || t('deliverTo')}
                  </Typography>
                  {deliveryLines.map((line) => (
                    <Typography
                      key={line}
                      className={`${fontClassName.className} ${ordersDetailClasses.infoText.mobile}`}
                    >
                      {line}
                    </Typography>
                  ))}
                  <Typography
                    className={`${fontClassName.className} ${ordersDetailClasses.infoText.mobile}`}
                  >
                    {order.deliveryPhone}
                  </Typography>
                  {showDelivery && (
                    <Typography
                      className={`${fontClassName.className} ${ordersDetailClasses.infoText.mobile}`}
                    >
                      {t('delivery')}: {deliveryFeeLabel}
                    </Typography>
                  )}
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
        <Box className={ordersDetailClasses.web.grid}>
          <AccountNav active="orders" />
          <Box className={ordersDetailClasses.web.col}>
            <Box className={ordersDetailClasses.web.headRow}>
              <Box className="min-w-0">
                <Typography
                  className={`${fontClassName.className} ${ordersDetailClasses.web.title}`}
                >
                  {t('orderDetails')}
                </Typography>
                <Typography
                  className={`${fontClassName.className} ${ordersDetailClasses.web.orderNumber}`}
                >
                  {order.orderNumber} · {formatDate(order.createdAt, platform)}
                </Typography>
              </Box>
              <Box className="flex flex-row items-center gap-3 flex-none">
                <OrderStatusBadge status={order.status} />
                {canCancelOrder() && (
                  <ButtonBase
                    disableRipple
                    onClick={() => setCancelDialogOpen(true)}
                    className={`${fontClassName.className} ${ordersDetailClasses.web.cancelButton}`}
                  >
                    {t('cancelOrder')}
                  </ButtonBase>
                )}
              </Box>
            </Box>

            <Box className={ordersDetailClasses.web.body}>
              {/* Items + totals */}
              <Box className={ordersDetailClasses.web.card}>
                <Typography
                  className={`${fontClassName.className} ${ordersDetailClasses.web.eyebrow}`}
                >
                  {t('orderedItems')} ({items.length})
                </Typography>
                {items.map((item) => {
                  const thumb = productThumbnailUrl(item.product?.imgUrls?.[0]);
                  const lineTotal =
                    (parseFloat(item.productPrice) || 0) * item.quantity;
                  return (
                    <Box
                      key={item.id}
                      className={ordersDetailClasses.web.itemRow}
                    >
                      <Box className={ordersDetailClasses.web.thumb}>
                        {thumb ? (
                          <CardMedia
                            component="img"
                            image={thumb}
                            alt=""
                            className={ordersDetailClasses.web.thumbImg}
                          />
                        ) : (
                          <Package
                            className={ordersDetailClasses.web.thumbIcon}
                          />
                        )}
                      </Box>
                      <Box className={ordersDetailClasses.web.itemBody}>
                        <Typography
                          className={`${fontClassName.className} ${ordersDetailClasses.web.itemName}`}
                        >
                          {parseName(item.productName, router.locale ?? 'tk')}
                        </Typography>
                        <Box className={ordersDetailClasses.web.itemMeta}>
                          {item.selectedVariant && (
                            <VariantBadge
                              {...parseOrderVariant(item.selectedVariant)}
                            />
                          )}
                          <span>× {item.quantity}</span>
                        </Box>
                      </Box>
                      <Typography
                        className={`${fontClassName.className} ${ordersDetailClasses.web.itemPrice}`}
                      >
                        {lineTotal.toFixed(2)} {t('manat')}
                      </Typography>
                    </Box>
                  );
                })}

                <Box className={ordersDetailClasses.web.totals}>
                  <Box
                    className={`${fontClassName.className} ${ordersDetailClasses.web.totalsRow}`}
                  >
                    <span>{t('subtotal')}</span>
                    <span>
                      {subtotal.toFixed(2)} {t('manat')}
                    </span>
                  </Box>
                  {showDelivery && (
                    <Box
                      className={`${fontClassName.className} ${ordersDetailClasses.web.totalsRow}`}
                    >
                      <span>{t('delivery')}</span>
                      <span
                        className={
                          isDeliveryFree
                            ? ordersDetailClasses.web.free
                            : undefined
                        }
                      >
                        {deliveryFeeLabel}
                      </span>
                    </Box>
                  )}
                  <Box className={ordersDetailClasses.web.grandRow}>
                    <Typography
                      className={`${fontClassName.className} ${ordersDetailClasses.web.grandLabel}`}
                    >
                      {t('orderTotal')}
                    </Typography>
                    <Typography
                      className={`${fontClassName.className} ${ordersDetailClasses.web.grandValue}`}
                    >
                      {orderTotal.toFixed(2)} {t('manat')}
                    </Typography>
                  </Box>
                </Box>
              </Box>

              {/* Delivery · payment · dates */}
              <Box className={ordersDetailClasses.web.sideCol}>
                <Box className={ordersDetailClasses.web.card}>
                  <Box className={ordersDetailClasses.web.sideHead}>
                    {isPickup ? (
                      <Store className={ordersDetailClasses.web.sideIcon} />
                    ) : (
                      <MapPin className={ordersDetailClasses.web.sideIcon} />
                    )}
                    <Typography
                      className={`${fontClassName.className} ${ordersDetailClasses.web.sideTitle}`}
                    >
                      {t('delivery')}
                    </Typography>
                  </Box>
                  {order.userName && (
                    <Typography
                      className={`${fontClassName.className} ${ordersDetailClasses.web.sideText}`}
                    >
                      {order.userName}
                    </Typography>
                  )}
                  {deliveryLines.map((line) => (
                    <Typography
                      key={line}
                      className={`${fontClassName.className} ${ordersDetailClasses.web.sideText}`}
                    >
                      {line}
                    </Typography>
                  ))}
                  <Typography
                    className={`${fontClassName.className} ${ordersDetailClasses.web.sideMuted}`}
                  >
                    {order.deliveryPhone}
                  </Typography>
                </Box>

                {order.notes && (
                  <Box className={ordersDetailClasses.web.card}>
                    <Box className={ordersDetailClasses.web.sideHead}>
                      <StickyNote
                        className={ordersDetailClasses.web.sideIcon}
                      />
                      <Typography
                        className={`${fontClassName.className} ${ordersDetailClasses.web.sideTitle}`}
                      >
                        {t('notes')}
                      </Typography>
                    </Box>
                    <Typography
                      className={`${fontClassName.className} ${ordersDetailClasses.web.sideText}`}
                    >
                      {order.notes}
                    </Typography>
                  </Box>
                )}

                <Box className={ordersDetailClasses.web.card}>
                  <Box className={ordersDetailClasses.web.sideHead}>
                    <Banknote
                      className={ordersDetailClasses.web.sideIconGreen}
                    />
                    <Typography
                      className={`${fontClassName.className} ${ordersDetailClasses.web.sideTitle}`}
                    >
                      {t('payment')}
                    </Typography>
                  </Box>
                  <Typography
                    className={`${fontClassName.className} ${ordersDetailClasses.web.sideText}`}
                  >
                    {t('cashOnDelivery')}
                  </Typography>
                  <Typography
                    className={`${fontClassName.className} ${ordersDetailClasses.web.sideMuted}`}
                  >
                    {t('payInCash')} — {orderTotal.toFixed(2)} {t('manat')}
                  </Typography>
                </Box>

                <Box className={ordersDetailClasses.web.card}>
                  <Typography
                    className={`${fontClassName.className} ${ordersDetailClasses.web.eyebrow}`}
                  >
                    {t('information')}
                  </Typography>
                  {timeline.map((entry) => (
                    <Box
                      key={entry.label}
                      className={`${fontClassName.className} ${ordersDetailClasses.web.metaRow}`}
                    >
                      <span className={ordersDetailClasses.web.metaKey}>
                        {entry.label}
                      </span>
                      <span className={ordersDetailClasses.web.metaValue}>
                        {entry.value}
                      </span>
                    </Box>
                  ))}
                </Box>
              </Box>
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
