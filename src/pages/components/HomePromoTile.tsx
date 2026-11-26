import OtherModelSaleBadge from '@/pages/components/sale/OtherModelSaleBadge';
import SaleBadge from '@/pages/components/sale/SaleBadge';
import SalePrice from '@/pages/components/sale/SalePrice';
import { useFetchWithCreds } from '@/pages/lib/fetch';
import {
  PRODUCT_IMAGE_FALLBACK,
  productThumbnailUrl,
} from '@/pages/lib/mediaUrls';
import { useProductContext } from '@/pages/lib/ProductContext';
import { ExtendedProduct } from '@/pages/lib/types';
import { useUserContext } from '@/pages/lib/UserContext';
import { parseName } from '@/pages/lib/utils';
import { computeProductPrice } from '@/pages/product/utils';
import { homePageClasses } from '@/styles/classMaps';
import { saleClasses } from '@/styles/classMaps/components/sale';
import { fontClassName } from '@/styles/theme';
import { Box, Typography } from '@mui/material';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';

const cls = homePageClasses.promoTile;

interface HomePromoTileProps {
  product: ExtendedProduct;
  tone: 'red' | 'grey';
}

/**
 * Web home side promo (spec 1332-1343). Highlights a real new arrival —
 * brand-less "New" eyebrow, real name, real price — plus its sale, if any.
 */
export default function HomePromoTile({ product, tone }: HomePromoTileProps) {
  const t = useTranslations();
  const router = useRouter();
  const { accessToken } = useUserContext();
  const { setSelectedProduct } = useProductContext();
  const fetchWithCreds = useFetchWithCreds();
  const [price, setPrice] = useState<string | undefined>(undefined);

  const imgSrc =
    productThumbnailUrl(product.imgUrls[0]) ?? PRODUCT_IMAGE_FALLBACK;

  // Same price resolution as ProductCard: the list API ships "[id]{value}",
  // so this normally resolves from the payload without a second request.
  useEffect(() => {
    let mounted = true;
    (async () => {
      const resolved = await computeProductPrice({
        product,
        accessToken,
        fetchWithCreds,
      });
      if (!mounted) return;
      setPrice(
        resolved.price?.includes('[') ? undefined : resolved.price ?? undefined,
      );
    })();
    return () => {
      mounted = false;
    };
  }, [product, accessToken]);

  // Out-of-stock products show neither a price nor anything about sales.
  const soldOut = product.outOfStockAt != null;
  const sale = soldOut ? null : product.sale;

  return (
    <Box
      className={`${cls.base} ${cls.tone[tone]}`}
      onClick={() => {
        setSelectedProduct(product);
        router.push(`/product/${product.slug}`);
      }}
    >
      <img
        src={imgSrc}
        alt=""
        className={cls.image}
        loading="lazy"
        decoding="async"
        onError={(e) => {
          const el = e.currentTarget;
          el.onerror = null;
          el.src = PRODUCT_IMAGE_FALLBACK;
        }}
      />
      <Box className={cls.content}>
        <Box className={saleClasses.tile.eyebrowRow}>
          <Typography
            className={`${fontClassName.className} ${cls.eyebrow[tone]}`}
          >
            {t('newest')}
          </Typography>
          {sale?.base != null && (
            <SaleBadge percent={sale.base.percent} size="web" />
          )}
        </Box>
        <Typography className={`${fontClassName.className} ${cls.title}`}>
          {parseName(product.name, router.locale ?? 'tk')}
        </Typography>
        {/* Out-of-stock products never show a price. */}
        {price != null &&
          !soldOut &&
          (sale?.base != null ? (
            <SalePrice
              price={price}
              oldPrice={sale.base.oldPrice}
              size="tile"
            />
          ) : (
            <Typography className={`${fontClassName.className} ${cls.price}`}>
              {price}
              <span className={cls.priceUnit}>{t('manat')}</span>
            </Typography>
          ))}
        {sale != null && sale.base == null && (
          <Box className={saleClasses.tile.otherModel}>
            <OtherModelSaleBadge percent={sale.bestPercent} platform="web" />
          </Box>
        )}
      </Box>
    </Box>
  );
}
