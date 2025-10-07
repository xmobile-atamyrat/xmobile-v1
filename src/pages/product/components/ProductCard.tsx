import BASE_URL from '@/lib/ApiEndpoints';
import { useAbortControllerContext } from '@/pages/lib/AbortControllerContext';
import { useCartState } from '@/pages/lib/CartContext';
import { useFetchWithCreds } from '@/pages/lib/fetch';
import { useNetworkContext } from '@/pages/lib/NetworkContext';
import { usePlatform } from '@/pages/lib/PlatformContext';
import { useProductContext } from '@/pages/lib/ProductContext';
import { AddToCartProps } from '@/pages/lib/types';
import { useUserContext } from '@/pages/lib/UserContext';
import { parseName } from '@/pages/lib/utils';
import IconGroup from '@/pages/product/components/IconGroup';
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
import { CartItem, Product } from '@prisma/client';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/router';
import { lazy, useEffect, useMemo, useState } from 'react';

// use lazy() to not to load the same compononets and functions in AddToCart
const AddToCart = lazy(() => import('@/pages/components/AddToCart'));

interface ProductCardProps {
  product?: Product;
  handleClickAddProduct?: () => void;
  cartProps?: AddToCartProps;
  cartItems?: CartItem[];
}

export default function ProductCard({
  product: initialProduct,
  handleClickAddProduct,
  cartProps,
}: ProductCardProps) {
  const t = useTranslations();
  const router = useRouter();
  const { setSelectedProduct } = useProductContext();
  const [imgUrl, setImgUrl] = useState<string | null>();
  const [product, setProduct] = useState(initialProduct);
  const { network } = useNetworkContext();
  const { accessToken } = useUserContext();
  const fetchWithCreds = useFetchWithCreds();
  const platform = usePlatform();
  const { createAbortController, clearAbortController } =
    useAbortControllerContext();
  const { cartItems } = useCartState();
  const cartItem = useMemo(
    () =>
      product
        ? cartItems.find((item) => item.productId === product.id)
        : undefined,
    [cartItems, product],
  );

  useEffect(() => {
    const abortController = createAbortController();

    (async () => {
      try {
        if (product?.imgUrls[0] != null && network !== 'unknown') {
          setImgUrl('/xmobile-original-logo.jpeg');
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
    <Card
      className={`${productCardClasses.card[platform]} group`}
      elevation={0}
    >
      {product != null ? (
        <Box
          className={productCardClasses.boxes.main}
          onClick={() => {
            setSelectedProduct(initialProduct);
            router.push(`/product/${product.id}`);
          }}
        >
          <Box>
            {imgUrl != null && (
              <Box className={productCardClasses.boxes.img[platform]}>
                <CardMedia
                  component="img"
                  image={imgUrl}
                  alt={product?.name}
                  className={productCardClasses.cardMedia[platform]}
                />
                {router.pathname === '/product' && (
                  <IconGroup
                    product={product}
                    inCart={!!cartItem}
                    cartItemId={cartItem?.id}
                  />
                )}
              </Box>
            )}
            <Box>
              <Typography
                gutterBottom
                className={`${productCardClasses.typo[platform]} ${interClassname.className}`}
                component="div"
              >
                {parseName(product.name, router.locale ?? 'tk').substring(
                  0,
                  24,
                )}
              </Typography>
            </Box>
            <Box className={productCardClasses.boxes.detail[platform]}>
              <Typography
                gutterBottom
                className={`${interClassname.className} ${productCardClasses.typo[platform]}`}
              >
                {parseName(product.name, router.locale ?? 'tk').substring(
                  0,
                  24,
                )}
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
            {cartProps.cartAction === 'delete' && (
              <Box onClick={(e) => e.stopPropagation()}>
                <AddToCart
                  productId={product.id}
                  cartAction={cartProps?.cartAction}
                  quantity={cartProps?.quantity}
                  cartItemId={cartProps?.cartItemId}
                  onDelete={cartProps?.onDelete}
                />
              </Box>
            )}
          </Box>
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
