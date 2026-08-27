import { useFetchWithCreds } from '@/pages/lib/fetch';
import {
  getProductMediaUrl,
  PRODUCT_IMAGE_FALLBACK,
  tierForProductList,
} from '@/pages/lib/mediaUrls';
import { useNetworkContext } from '@/pages/lib/NetworkContext';
import { useProductContext } from '@/pages/lib/ProductContext';
import { useUserContext } from '@/pages/lib/UserContext';
import { parseName } from '@/pages/lib/utils';
import { computeProductPrice } from '@/pages/product/utils';
import { homePageClasses } from '@/styles/classMaps';
import { fontClassName } from '@/styles/theme';
import { Box, Typography } from '@mui/material';
import { Product } from '@prisma/client';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/router';
import { useEffect, useMemo, useState } from 'react';

const cls = homePageClasses.promoTile;

interface HomePromoTileProps {
  product: Product;
  tone: 'red' | 'grey';
}

/**
 * Web home side promo (spec 1332-1343). The design's tile is a discount promo;
 * the schema has no discount/old-price data, so it highlights a real new arrival
 * instead — brand-less "New" eyebrow, real name, real price.
 */
export default function HomePromoTile({ product, tone }: HomePromoTileProps) {
  const t = useTranslations();
  const router = useRouter();
  const { network } = useNetworkContext();
  const { accessToken } = useUserContext();
  const { setSelectedProduct } = useProductContext();
  const fetchWithCreds = useFetchWithCreds();
  const [price, setPrice] = useState<string | undefined>(undefined);

  const imgSrc = useMemo(() => {
    const raw = product.imgUrls[0];
    if (raw == null) return PRODUCT_IMAGE_FALLBACK;
    if (raw.startsWith('http')) return raw;
    return (
      getProductMediaUrl(tierForProductList(network), raw) ??
      PRODUCT_IMAGE_FALLBACK
    );
  }, [product.imgUrls, network]);

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
        <Typography
          className={`${fontClassName.className} ${cls.eyebrow[tone]}`}
        >
          {t('newest')}
        </Typography>
        <Typography className={`${fontClassName.className} ${cls.title}`}>
          {parseName(product.name, router.locale ?? 'tk')}
        </Typography>
        {/* Out-of-stock products never show a price. */}
        {price != null && !product.isOutOfStock && (
          <Typography className={`${fontClassName.className} ${cls.price}`}>
            {price}
            <span className={cls.priceUnit}>{t('manat')}</span>
          </Typography>
        )}
      </Box>
    </Box>
  );
}
