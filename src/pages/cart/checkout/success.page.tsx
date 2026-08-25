import Layout from '@/pages/components/Layout';
import VariantBadge from '@/pages/components/VariantBadge';
import { fetchWithoutCreds, useFetchWithCreds } from '@/pages/lib/fetch';
import {
  getProductMediaUrl,
  PRODUCT_IMAGE_FALLBACK,
  tierForProductList,
} from '@/pages/lib/mediaUrls';
import { useNetworkContext } from '@/pages/lib/NetworkContext';
import { usePlatform } from '@/pages/lib/PlatformContext';
import { useUserContext } from '@/pages/lib/UserContext';
import { parseName } from '@/pages/lib/utils';
import { parseOrderVariant } from '@/pages/product/utils';
import { checkoutSuccessClasses } from '@/styles/classMaps/cart/checkoutSuccess';
import { colors, fontClassName, navy } from '@/styles/theme';
import { Box, Button, CardMedia, Typography } from '@mui/material';
import { UserOrder } from '@prisma/client';
import { Banknote, Check, Package, Truck } from 'lucide-react';
import { GetStaticProps } from 'next';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';

// What the order endpoints actually return: the order plus its item snapshots,
// each carrying the product it was ordered from (for the thumbnail).
type ConfirmedOrder = UserOrder & {
  items?: Array<{
    id: string;
    quantity: number;
    productName: string;
    productPrice: string;
    selectedVariant?: string | null;
    product?: { imgUrls: string[] } | null;
  }>;
};

// getStaticProps because translations are static
export const getStaticProps = (async (context) => {
  return {
    props: {
      messages: (await import(`../../../i18n/${context.locale}.json`)).default,
    },
  };
}) satisfies GetStaticProps<object>;

export default function CheckoutSuccessPage() {
  const t = useTranslations();
  const platform = usePlatform();
  const router = useRouter();
  const { user, accessToken } = useUserContext();
  const fetchWithCreds = useFetchWithCreds();
  const { network } = useNetworkContext();
  const [order, setOrder] = useState<ConfirmedOrder | null>(null);
  const orderNumber = order?.orderNumber ?? null;

  // Fetch the most recent order — the whole thing, not just its number: the web
  // confirmation renders its items, address and total (spec 2192-2207).
  useEffect(() => {
    (async () => {
      try {
        // The guest branch used to be unreachable behind an early
        // `if (!user || !accessToken) return`, so guests never saw their order.
        if (user && accessToken) {
          const { success, data } = await fetchWithCreds<{
            orders: ConfirmedOrder[];
            pagination?: unknown;
          }>({
            accessToken,
            path: '/api/order?limit=1', // get the last order
            method: 'GET',
          });

          if (success && data?.orders && data.orders.length > 0) {
            setOrder(data.orders[0]);
          }
        } else if (!user) {
          const guestResp = await fetchWithoutCreds<ConfirmedOrder[]>(
            '/api/guest/order',
            'GET',
          );
          if (guestResp.success && guestResp.data?.length > 0) {
            setOrder(guestResp.data[0]);
          }
        }
      } catch (error) {
        console.error('Error fetching order:', error);
      }
    })();
  }, [user, accessToken, fetchWithCreds]);

  // 52px item thumbnails — same tiered media path the cards use
  const thumbSrc = (raw: string | undefined) => {
    if (raw == null) return undefined;
    if (raw.startsWith('http')) return raw;
    return (
      getProductMediaUrl(tierForProductList(network), raw) ??
      PRODUCT_IMAGE_FALLBACK
    );
  };

  const items = order?.items ?? [];
  const subtotal = items.reduce(
    (acc, item) => acc + (parseFloat(item.productPrice) || 0) * item.quantity,
    0,
  );
  const totalPaid = parseFloat(order?.totalPrice ?? '') || subtotal;

  // Desktop confirmation (spec 2186-2211): centred success block over an order
  // summary card and a delivery/payment column.
  if (platform === 'web') {
    return (
      <Layout handleHeaderBackButton={() => router.push('/')}>
        <Box className={checkoutSuccessClasses.web.page}>
          <Box className={checkoutSuccessClasses.web.head}>
            <Box className={checkoutSuccessClasses.web.badge}>
              <Check size={38} strokeWidth={2.2} />
            </Box>
            <Typography
              className={`${fontClassName.className} ${checkoutSuccessClasses.web.title}`}
              component="h1"
            >
              {t('thankYou')}
            </Typography>
            <Typography
              className={`${fontClassName.className} ${checkoutSuccessClasses.web.sub}`}
            >
              {t('yourOrder')}{' '}
              {orderNumber && (
                <span className={checkoutSuccessClasses.web.orderNumber}>
                  {orderNumber}
                </span>
              )}{' '}
              {t('isCompleted')} {t('waitForConfirmation')}
            </Typography>
          </Box>

          <Box className={checkoutSuccessClasses.web.grid}>
            {/* Order summary — real item snapshots taken at order time */}
            <Box className={checkoutSuccessClasses.web.card}>
              <Typography
                className={`${fontClassName.className} ${checkoutSuccessClasses.web.eyebrow}`}
              >
                {t('orderSummary')}
              </Typography>
              {items.map((item) => {
                const thumb = thumbSrc(item.product?.imgUrls?.[0]);
                const lineTotal =
                  (parseFloat(item.productPrice) || 0) * item.quantity;
                return (
                  <Box
                    key={item.id}
                    className={checkoutSuccessClasses.web.itemRow}
                  >
                    <Box className={checkoutSuccessClasses.web.thumb}>
                      {thumb && (
                        <CardMedia
                          component="img"
                          image={thumb}
                          alt={parseName(
                            item.productName,
                            router.locale ?? 'tk',
                          )}
                          className={checkoutSuccessClasses.web.thumbImg}
                          loading="lazy"
                          decoding="async"
                          onError={(e) => {
                            const el = e.currentTarget;
                            el.onerror = null;
                            el.src = PRODUCT_IMAGE_FALLBACK;
                          }}
                        />
                      )}
                    </Box>
                    <Box className={checkoutSuccessClasses.web.itemBody}>
                      <Typography
                        className={`${fontClassName.className} ${checkoutSuccessClasses.web.itemName}`}
                      >
                        {parseName(item.productName, router.locale ?? 'tk')}
                      </Typography>
                      <Box className={checkoutSuccessClasses.web.itemMeta}>
                        {item.selectedVariant && (
                          <VariantBadge
                            {...parseOrderVariant(item.selectedVariant)}
                          />
                        )}
                        <span>× {item.quantity}</span>
                      </Box>
                    </Box>
                    <Typography
                      className={`${fontClassName.className} ${checkoutSuccessClasses.web.itemPrice}`}
                    >
                      {lineTotal.toFixed(2)}
                    </Typography>
                  </Box>
                );
              })}
              <Box className={checkoutSuccessClasses.web.totals}>
                <Box className={checkoutSuccessClasses.web.totalsRow}>
                  <span>{t('subtotal')}</span>
                  <span>
                    {subtotal.toFixed(2)} {t('manat')}
                  </span>
                </Box>
                <Box className={checkoutSuccessClasses.web.totalsRow}>
                  <span>{t('delivery')}</span>
                  <span className={checkoutSuccessClasses.web.free}>
                    {t('free')}
                  </span>
                </Box>
                <Box className={checkoutSuccessClasses.web.grandRow}>
                  <span className={checkoutSuccessClasses.web.grandLabel}>
                    {t('total')}
                  </span>
                  <span className={checkoutSuccessClasses.web.grandValue}>
                    {totalPaid.toFixed(2)} {t('manat')}
                  </span>
                </Box>
              </Box>
            </Box>

            {/* Delivery + payment, then the two next steps */}
            <Box className={checkoutSuccessClasses.web.sideCol}>
              <Box className={checkoutSuccessClasses.web.card}>
                <Box className={checkoutSuccessClasses.web.sideHead}>
                  <Truck className={checkoutSuccessClasses.web.sideIcon} />
                  <Typography
                    className={`${fontClassName.className} ${checkoutSuccessClasses.web.sideTitle}`}
                  >
                    {t('delivery')}
                  </Typography>
                </Box>
                <Typography
                  className={`${fontClassName.className} ${checkoutSuccessClasses.web.sideBody}`}
                >
                  {order?.deliveryAddress}
                  {order?.deliveryPhone ? ` · ${order.deliveryPhone}` : ''}
                </Typography>
              </Box>

              <Box className={checkoutSuccessClasses.web.card}>
                <Box className={checkoutSuccessClasses.web.sideHead}>
                  <Banknote
                    className={checkoutSuccessClasses.web.sideIconGreen}
                  />
                  <Typography
                    className={`${fontClassName.className} ${checkoutSuccessClasses.web.sideTitle}`}
                  >
                    {t('payment')}
                  </Typography>
                </Box>
                <Typography
                  className={`${fontClassName.className} ${checkoutSuccessClasses.web.sideBody}`}
                >
                  {t('cashOnDelivery')}
                  <br />
                  {t('payInCash')} — {totalPaid.toFixed(2)} {t('manat')}
                </Typography>
              </Box>

              {/* The mockup's "Track order" — there is no courier tracking, so
                  this goes to the real order (status, items, cancel). */}
              <Button
                onClick={() =>
                  router.push(order ? `/orders/${order.id}` : '/orders')
                }
                className={`${fontClassName.className} ${checkoutSuccessClasses.web.primaryBtn}`}
                sx={{
                  backgroundColor: navy,
                  color: 'white',
                  '&:hover': { backgroundColor: colors.buttonHoverBg },
                }}
              >
                <Package size={18} />
                {t('orderDetails')}
              </Button>
              <Button
                onClick={() => router.push('/')}
                className={`${fontClassName.className} ${checkoutSuccessClasses.web.secondaryBtn}`}
                sx={{ color: navy }}
              >
                {t('continueShopping')}
              </Button>
            </Box>
          </Box>
        </Box>
      </Layout>
    );
  }

  return (
    <Layout handleHeaderBackButton={() => router.push('/')}>
      <Box className={checkoutSuccessClasses.container.mobile}>
        {/* Success badge */}
        <Box className={checkoutSuccessClasses.badgeOuter.mobile}>
          <Box className={checkoutSuccessClasses.badgeInner.mobile}>
            <Check size={34} color="#fff" strokeWidth={2.5} />
          </Box>
        </Box>

        {/* Title */}
        <Typography
          className={`${fontClassName.className} ${checkoutSuccessClasses.title.mobile}`}
        >
          {t('thankYou')}
        </Typography>

        {/* Message */}
        <Box className={checkoutSuccessClasses.message.mobile}>
          <Typography
            className={`${fontClassName.className} ${checkoutSuccessClasses.yourOrder.mobile}`}
          >
            {t('yourOrder')}{' '}
            {orderNumber && (
              <span
                className={`${fontClassName.className} ${checkoutSuccessClasses.orderNumber.mobile}`}
              >
                {orderNumber}
              </span>
            )}{' '}
            {t('isCompleted')}
          </Typography>
          <Typography
            className={`${fontClassName.className} ${checkoutSuccessClasses.confirmation.mobile}`}
          >
            {t('waitForConfirmation')}
          </Typography>
        </Box>

        {/* Buttons */}
        <Box className={checkoutSuccessClasses.buttonContainer.mobile}>
          <Button
            onClick={() => router.push('/orders')}
            className={`${fontClassName.className} ${checkoutSuccessClasses.buttonPrimary.mobile}`}
            sx={{
              backgroundColor: navy,
              color: 'white',
              '&:hover': { backgroundColor: colors.buttonHoverBg },
            }}
          >
            {t('myOrders')}
          </Button>
          <Button
            onClick={() => router.push('/')}
            className={`${fontClassName.className} ${checkoutSuccessClasses.buttonSecondary.mobile}`}
            sx={{ color: navy }}
          >
            {t('continueShopping')}
          </Button>
        </Box>
      </Box>
    </Layout>
  );
}
