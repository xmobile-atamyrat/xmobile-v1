import BASE_URL from '@/lib/ApiEndpoints';
import { useAbortControllerContext } from '@/pages/lib/AbortControllerContext';
import { useNetworkContext } from '@/pages/lib/NetworkContext';
import { usePlatform } from '@/pages/lib/PlatformContext';
import { useProductContext } from '@/pages/lib/ProductContext';
import { AddToCartProps } from '@/pages/lib/types';
import { parseName } from '@/pages/lib/utils';
import { cartProductCardClasses } from '@/styles/classMaps/cart/productCard';
import { colors, interClassname } from '@/styles/theme';
import { Box, Card, CardMedia, Divider, Typography } from '@mui/material';
import CircularProgress from '@mui/material/CircularProgress';
import { Product } from '@prisma/client';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/router';
import { lazy, useEffect, useState } from 'react';

// use lazy() to not to load the same compononets and functions in AddToCart
const AddToCart = lazy(() => import('@/pages/components/AddToCart'));

interface ProductCardProps {
  product?: Product;
  handleClickAddProduct?: () => void;
  cartProps?: AddToCartProps;
}

export default function CartProductCard({
  product,
  cartProps,
}: ProductCardProps) {
  const t = useTranslations();
  const router = useRouter();
  const { setSelectedProduct } = useProductContext();
  const [imgUrl, setImgUrl] = useState<string | null>();
  const { network } = useNetworkContext();
  const { createAbortController, clearAbortController } =
    useAbortControllerContext();
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

  useEffect(() => {
    const abortController = createAbortController();

    (async () => {
      try {
        if (product?.imgUrls[0] != null && network !== 'unknown') {
          setImgUrl('/logo/xmobile-original-logo.jpeg');
          if (product.imgUrls[0].startsWith('http')) {
            setImgUrl(product.imgUrls[0]);
          } else {
            const imgFetcher = fetch(
              `${BASE_URL}/api/localImage?imgUrl=${product.imgUrls[0]}&network=${network}`,
              { signal: abortController.signal },
            );
            const resp = await imgFetcher;
            if (resp.ok) {
              setImgUrl(URL.createObjectURL(await resp.blob()));
            }
          }
        }
      } catch (error) {
        if (error.name !== 'AbortError') {
          console.error(error);
        }
      } finally {
        clearAbortController(abortController);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product?.imgUrls, network]);

  return (
    <Box>
      <Card className={cartProductCardClasses.card[platform]} elevation={0}>
        <Box
          className={cartProductCardClasses.boxes.main[platform]}
          onClick={() => {
            setSelectedProduct(product);
            router.push(`/product/${product.id}`);
          }}
        >
          {imgUrl != null && (
            <Box className={cartProductCardClasses.boxes.img[platform]}>
              <CardMedia
                component="img"
                image={imgUrl}
                alt={product?.name}
                className={cartProductCardClasses.cardMedia[platform]}
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
              </Box>
              {product?.price?.includes('[') ? (
                <CircularProgress
                  className={cartProductCardClasses.circProgress[platform]}
                />
              ) : (
                <Typography
                  color={colors.text[platform]}
                  className={`${interClassname.className} ${cartProductCardClasses.typo2[platform]} ml-[1vw]`}
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
