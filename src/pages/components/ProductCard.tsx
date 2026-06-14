import { useFetchWithCreds } from '@/pages/lib/fetch';
import {
  getProductMediaUrl,
  PRODUCT_IMAGE_FALLBACK,
  tierForProductList,
} from '@/pages/lib/mediaUrls';
import { useNetworkContext } from '@/pages/lib/NetworkContext';
import { usePlatform } from '@/pages/lib/PlatformContext';
import { useProductContext } from '@/pages/lib/ProductContext';
import { AddToCartProps } from '@/pages/lib/types';
import { useUserContext } from '@/pages/lib/UserContext';
import { parseName } from '@/pages/lib/utils';
import { computeProductPrice } from '@/pages/product/utils';
import { productCardClasses } from '@/styles/classMaps/components/productCard';
import { colors, interClassname } from '@/styles/theme';
import AddCircleIcon from '@mui/icons-material/AddCircle';
import {
  Box,
  Card,
  CardActions,
  CardContent,
  CardMedia,
  Divider,
  IconButton,
  Typography,
} from '@mui/material';
import CircularProgress from '@mui/material/CircularProgress';
import { Product } from '@prisma/client';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/router';
import { lazy, useEffect, useMemo, useState } from 'react';

// use lazy() to not to load the same compononets and functions in AddToCart
const AddToCart = lazy(() => import('@/pages/components/AddToCart'));

interface ProductCardProps {
  product?: Product;
  handleClickAddProduct?: () => void;
  cartProps?: AddToCartProps;
}

export default function ProductCard({
  product: initialProduct,
  handleClickAddProduct,
  cartProps,
}: ProductCardProps) {
  const t = useTranslations();
  const router = useRouter();
  const { setSelectedProduct } = useProductContext();
  const [product, setProduct] = useState(initialProduct);
  const { network } = useNetworkContext();
  const { accessToken } = useUserContext();
  const fetchWithCreds = useFetchWithCreds();
  const platform = usePlatform();

  const cardImageSrc = useMemo(() => {
    const raw = product?.imgUrls[0];
    if (raw == null) return undefined;
    if (raw.startsWith('http')) return raw;
    const tier = tierForProductList(network);
    return getProductMediaUrl(tier, raw) ?? PRODUCT_IMAGE_FALLBACK;
  }, [product?.imgUrls, network]);

  useEffect(() => {
    if (initialProduct == null) return;

    (async () => {
      setProduct(
        await computeProductPrice({
          product: initialProduct,
          accessToken,
          fetchWithCreds,
        }),
      );
    })();
  }, [initialProduct]);

  return (
    <Card className={productCardClasses.card[platform]} elevation={0}>
      {product != null ? (
        <Box
          className={productCardClasses.boxes.main}
          onClick={() => {
            setSelectedProduct(initialProduct);
            router.push(`/product/${product.slug}`);
          }}
        >
          {cardImageSrc != null && (
            <Box className={productCardClasses.boxes.img[platform]}>
              <CardMedia
                component="img"
                image={cardImageSrc}
                alt={product?.name}
                className={productCardClasses.cardMedia[platform]}
                loading="lazy"
                decoding="async"
                onError={(e) => {
                  const el = e.currentTarget;
                  el.onerror = null;
                  el.src = PRODUCT_IMAGE_FALLBACK;
                }}
              />
              {product.isOutOfStock && (
                <Box className="absolute bottom-0 left-0 right-0 bg-black/50 flex items-center justify-center py-1.5">
                  <Typography
                    className={`text-white font-semibold tracking-widest uppercase ${platform === 'web' ? 'text-xs' : 'text-[10px]'}`}
                  >
                    {t('outOfStock')}
                  </Typography>
                </Box>
              )}
            </Box>
          )}
          <Box className={productCardClasses.boxes.detail[platform]}>
            <Typography
              gutterBottom
              className={`${interClassname.className} ${productCardClasses.typo[platform]}`}
            >
              {parseName(product.name, router.locale ?? 'tk')}
            </Typography>
            {product?.price?.includes('[') ? (
              <CircularProgress
                className={productCardClasses.circProgress[platform]}
              />
            ) : (
              <Typography
                color={colors.mainWebMobile[platform]}
                className={`${interClassname.className} ${productCardClasses.typo2[platform]}`}
              >
                {product?.price} {t('manat')}
              </Typography>
            )}
          </Box>
          {cartProps.cartAction === 'delete' && !product.isOutOfStock && (
            <Box onClick={(e) => e.stopPropagation()}>
              <AddToCart
                productId={product.id}
                cartAction={cartProps?.cartAction}
                quantity={cartProps?.quantity}
                cartItemId={cartProps?.cartItemId}
                onDelete={cartProps?.onDelete}
                setTotalPrice={() => undefined}
              />
            </Box>
          )}
        </Box>
      ) : (
        <Box className="w-full h-full flex flex-col justify-between">
          <CardContent className="p-1">
            <Typography
              gutterBottom
              className={productCardClasses.typo3[platform]}
            >
              {t('addNewProduct')}
            </Typography>
          </CardContent>
          <Box>
            <Divider />
            <CardActions className={productCardClasses.cardActions}>
              <IconButton
                onClick={() => {
                  if (handleClickAddProduct) handleClickAddProduct();
                }}
              >
                <AddCircleIcon fontSize="large" color="primary" />
              </IconButton>
            </CardActions>
          </Box>
        </Box>
      )}
    </Card>
  );
}
