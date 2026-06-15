import BASE_URL from '@/lib/ApiEndpoints';
import {
  getProductMediaUrl,
  PRODUCT_IMAGE_FALLBACK,
  tierForProductList,
} from '@/pages/lib/mediaUrls';
import { useNetworkContext } from '@/pages/lib/NetworkContext';
import { usePlatform } from '@/pages/lib/PlatformContext';
import { useProductContext } from '@/pages/lib/ProductContext';
import VariantBadge from '@/pages/components/VariantBadge';
import { AddToCartProps } from '@/pages/lib/types';
import { parseName } from '@/pages/lib/utils';
import { resolveVariantDisplay } from '@/pages/product/utils';
import { cartProductCardClasses } from '@/styles/classMaps/cart/productCard';
import { colors, interClassname } from '@/styles/theme';
import { Box, Card, CardMedia, Divider, Typography } from '@mui/material';
import CircularProgress from '@mui/material/CircularProgress';
import { Color, Product } from '@prisma/client';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/router';
import { lazy, useEffect, useMemo, useState } from 'react';

// use lazy() to not to load the same compononets and functions in AddToCart
const AddToCart = lazy(() => import('@/pages/components/AddToCart'));

interface ProductCardProps {
  product?: Product;
  handleClickAddProduct?: () => void;
  cartProps?: AddToCartProps;
  selectedVariant?: string | null;
  colorsMap?: Map<string, Color>;
}

export default function CartProductCard({
  product,
  cartProps,
  selectedVariant,
  colorsMap,
}: ProductCardProps) {
  const t = useTranslations();
  const router = useRouter();
  const { setSelectedProduct } = useProductContext();
  const { network } = useNetworkContext();
  const platform = usePlatform();
  const [categoryName, setCategoryName] = useState<string | null>(null);

  useEffect(() => {
    if (!product?.categoryId) return () => {};
    let cancelled = false;
    (async () => {
      try {
        const resp = await fetch(
          `${BASE_URL}/api/category?categoryId=${product.categoryId}`,
        );
        const { success, data } = await resp.json();
        if (!cancelled && success) setCategoryName(data?.name ?? null);
      } catch (err: any) {
        console.error('fetch category name', err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [product?.categoryId]);

  const cardImageSrc = useMemo(() => {
    const raw = product?.imgUrls[0];
    if (raw == null) return undefined;
    if (raw.startsWith('http')) return raw;
    const tier = tierForProductList(network);
    return getProductMediaUrl(tier, raw) ?? PRODUCT_IMAGE_FALLBACK;
  }, [product?.imgUrls, network]);

  return (
    <Box>
      <Card className={cartProductCardClasses.card[platform]} elevation={0}>
        <Box
          className={cartProductCardClasses.boxes.main[platform]}
          onClick={() => {
            setSelectedProduct(product);
            router.push(`/product/${product.slug}`);
          }}
        >
          {cardImageSrc != null && (
            <Box className={cartProductCardClasses.boxes.img[platform]}>
              <CardMedia
                component="img"
                image={cardImageSrc}
                alt={product?.name}
                className={cartProductCardClasses.cardMedia[platform]}
                loading="lazy"
                decoding="async"
                onError={(e) => {
                  const el = e.currentTarget;
                  el.onerror = null;
                  el.src = PRODUCT_IMAGE_FALLBACK;
                }}
              />
            </Box>
          )}
          <Box className={cartProductCardClasses.info[platform]}>
            <Box className={cartProductCardClasses.det2[platform]}>
              <Box className={cartProductCardClasses.boxes.detail[platform]}>
                <Typography
                  className={`${interClassname.className} ${cartProductCardClasses.categoryName[platform]}`}
                >
                  {categoryName &&
                    parseName(categoryName, router.locale ?? 'tk')}
                </Typography>
                <Typography
                  gutterBottom
                  className={`${interClassname.className} ${cartProductCardClasses.typo[platform]}`}
                >
                  {parseName(product.name, router.locale ?? 'tk').substring(
                    0,
                    24,
                  )}
                </Typography>
                {selectedVariant && (
                  <VariantBadge
                    {...resolveVariantDisplay(
                      selectedVariant,
                      colorsMap ?? new Map(),
                    )}
                  />
                )}
              </Box>
              {product?.price?.includes('[') ? (
                <CircularProgress
                  className={cartProductCardClasses.circProgress[platform]}
                />
              ) : (
                <Typography
                  color={colors.text[platform]}
                  className={`${interClassname.className} ${cartProductCardClasses.typo2[platform]}`}
                >
                  {product?.price} {t('manat')}
                </Typography>
              )}
            </Box>
            {cartProps.cartAction === 'delete' && (
              <Box onClick={(e) => e.stopPropagation()}>
                <AddToCart
                  productId={product.id}
                  cartAction={cartProps?.cartAction}
                  quantity={cartProps?.quantity}
                  cartItemId={cartProps?.cartItemId}
                  price={product.price}
                  onDelete={cartProps?.onDelete}
                  setTotalPrice={cartProps?.setTotalPrice}
                />
              </Box>
            )}
          </Box>
        </Box>
      </Card>
      <Divider className={cartProductCardClasses.divider[platform]} />
    </Box>
  );
}
