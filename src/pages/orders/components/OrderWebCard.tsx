import {
  getProductMediaUrl,
  PRODUCT_IMAGE_FALLBACK,
  tierForProductList,
} from '@/pages/lib/mediaUrls';
import { useNetworkContext } from '@/pages/lib/NetworkContext';
import { formatDate } from '@/pages/orders/lib/utils';
import { UserOrderWithItems } from '@/pages/orders/lib/apiUtils';
import { ordersComponentClasses } from '@/styles/classMaps/orders/components';
import { fontClassName } from '@/styles/theme';
import { Box, ButtonBase, CardMedia, Typography } from '@mui/material';
import { ChevronRight, Package } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/router';
import OrderStatusBadge from './OrderStatusBadge';

const MAX_THUMBS = 3;

/**
 * Desktop order-history card (spec 1760-1789).
 *
 * Skipped from the mockup under the real-data rule: the 4-stage delivery
 * tracker and "arrives today ~18:40" (`UserOrder.status` is a 5-value enum with
 * no courier, stage or ETA data — the status badge already says everything the
 * schema knows), "Track live" (no map/courier), "Buy again" (needs a
 * re-add-to-cart flow, not a restyle), "Invoice" (nothing generates one) and
 * "Leave review" (no `Review` model).
 */
export default function OrderWebCard({ order }: { order: UserOrderWithItems }) {
  const router = useRouter();
  const t = useTranslations();
  const { network } = useNetworkContext();

  const items = order.items ?? [];
  const shown = items.slice(0, MAX_THUMBS);
  const overflow = items.length - shown.length;

  // Same tiered media path the product cards use.
  const thumbSrc = (raw: string | undefined) => {
    if (raw == null) return undefined;
    if (raw.startsWith('http')) return raw;
    return (
      getProductMediaUrl(tierForProductList(network), raw) ??
      PRODUCT_IMAGE_FALLBACK
    );
  };

  const openDetail = () => router.push(`/orders/${order.id}`);

  return (
    <Box className={ordersComponentClasses.webCard.card} onClick={openDetail}>
      <Box className={ordersComponentClasses.webCard.head}>
        <Typography
          className={`${fontClassName.className} ${ordersComponentClasses.webCard.meta}`}
        >
          {t('orderNumber')}{' '}
          <span className={ordersComponentClasses.webCard.metaNumber}>
            {order.orderNumber}
          </span>{' '}
          · {formatDate(order.createdAt, 'web')}
        </Typography>
        <OrderStatusBadge status={order.status} />
      </Box>

      <Box className={ordersComponentClasses.webCard.foot}>
        <Box className={ordersComponentClasses.webCard.thumbs}>
          {shown.map((item) => {
            const thumb = thumbSrc(item.product?.imgUrls?.[0]);
            return (
              <Box
                key={item.id}
                className={ordersComponentClasses.webCard.thumb}
              >
                {thumb ? (
                  <CardMedia
                    component="img"
                    image={thumb}
                    alt=""
                    className={ordersComponentClasses.webCard.thumbImg}
                  />
                ) : (
                  <Package
                    className={ordersComponentClasses.webCard.thumbIcon}
                  />
                )}
              </Box>
            );
          })}
          {overflow > 0 && (
            <Box
              className={`${ordersComponentClasses.webCard.more} ${fontClassName.className}`}
            >
              +{overflow}
            </Box>
          )}
          <Typography
            className={`${fontClassName.className} ${ordersComponentClasses.webCard.total}`}
          >
            <span className={ordersComponentClasses.webCard.totalValue}>
              {parseFloat(order.totalPrice).toFixed(2)} TMT
            </span>
          </Typography>
        </Box>

        <ButtonBase
          disableRipple
          onClick={(event) => {
            event.stopPropagation();
            openDetail();
          }}
          className={`${ordersComponentClasses.webCard.action} ${fontClassName.className}`}
        >
          {t('orderDetails')}
          <ChevronRight size={16} />
        </ButtonBase>
      </Box>
    </Box>
  );
}
