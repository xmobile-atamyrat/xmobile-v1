import BASE_URL from '@/lib/ApiEndpoints';
import { useAbortControllerContext } from '@/pages/lib/AbortControllerContext';
import { useFetchWithCreds } from '@/pages/lib/fetch';
import { useNetworkContext } from '@/pages/lib/NetworkContext';
import { useProductContext } from '@/pages/lib/ProductContext';
import { AddToCartProps } from '@/pages/lib/types';
import { useUserContext } from '@/pages/lib/UserContext';
import { parseName } from '@/pages/lib/utils';
import { computeProductPrice } from '@/pages/product/utils';
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
  useMediaQuery,
  useTheme,
} from '@mui/material';
import CircularProgress from '@mui/material/CircularProgress';
import { Product } from '@prisma/client';
import classNames from 'classnames';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/router';
import { lazy, useEffect, useState } from 'react';

// use lazy() to not to load the same compononets and functions in AddToCart
const AddToCart = lazy(() => import('@/pages/components/AddToCart'));

interface ProductCardProps {
  product?: Product;
  handleClickAddProduct?: () => void;
  cardClassName?: string;
  cartProps?: AddToCartProps;
}

export default function ProductCard({
  product: initialProduct,
  handleClickAddProduct,
  cardClassName,
  cartProps,
}: ProductCardProps) {
  const t = useTranslations();
  const router = useRouter();
  const { setSelectedProduct } = useProductContext();
  const [imgUrl, setImgUrl] = useState<string | null>();
  const [product, setProduct] = useState(initialProduct);
  const theme = useTheme();
  const isMdUp = useMediaQuery(theme.breakpoints.up('md'));
  const { network } = useNetworkContext();
  const { createAbortController, clearAbortController } =
    useAbortControllerContext();
  const { accessToken } = useUserContext();
  const fetchWithCreds = useFetchWithCreds();

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
      sx={{
        width: { xs: '47%', sm: 200 },
        height: { xs: 260, sm: 300 },
        ':hover': { boxShadow: 10 },
      }}
      className={classNames('border-[1px] px-2 py-2 relative', cardClassName)}
    >
      {product != null ? (
        <Box
          className="relative h-full w-full flex flex-col justify-between p-1"
          onClick={() => {
            setSelectedProduct(initialProduct);
            router.push(`/product/detail`);
          }}
        >
          <Box className="h-5/6">
            {imgUrl != null && (
              <Box className="flex justify-center">
                <CardMedia
                  component="img"
                  image={imgUrl}
                  alt={product?.name}
                  sx={{
                    height: { xs: 100 },
                    width: 'auto',
                    p: 0,
                  }}
                />
              </Box>
            )}
            <Box>
              <Typography
                gutterBottom
                sx={{ fontSize: { xs: 14, sm: 18 }, mt: 1 }}
                component="div"
              >
                {parseName(product.name, router.locale ?? 'tk').substring(
                  0,
                  24,
                )}
              </Typography>
            </Box>
            {/* hide description on cart page */}
            {cartProps.cartAction === 'add' && (
              <Box
                className={`w-full overflow-y-scroll overflow-x-hidden ${product.imgUrls[0] != null ? 'h-1/4' : 'h-3/5'}`}
              >
                {parseName(product.description ?? '{}', router.locale ?? 'tk')
                  ?.split('\n')
                  ?.filter((desc) => {
                    const trimmedDesc = desc.trim().split(']');
                    return trimmedDesc.length > 1 && trimmedDesc[1] !== '';
                  })
                  ?.map((desc, index) => (
                    <Typography
                      key={`${desc}-${index}`}
                      variant="body2"
                      color="text.secondary"
                    >
                      {desc.replace('[', '').replace(']', ':')}
                    </Typography>
                  ))}
              </Box>
            )}
          </Box>
          <Box className="flex items-end justify-between">
            {product?.price?.includes('[') ? (
              <CircularProgress size={isMdUp ? 30 : 24} />
            ) : (
              <Typography
                sx={{ fontSize: { xs: 14, sm: 16 } }}
                fontWeight={600}
              >
                {product?.price} {t('manat')}
              </Typography>
            )}
            {cartProps.cartAction === 'add' && (
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
      ) : (
        <Box className="w-full h-full flex flex-col justify-between">
          <CardContent sx={{ p: 1 }}>
            <Typography
              gutterBottom
              className="flex justify-center"
              fontSize={isMdUp ? 20 : 18}
              fontWeight={500}
              style={{
                textAlign: 'center',
              }}
            >
              {t('addNewProduct')}
            </Typography>
          </CardContent>
          <Box>
            <Divider />
            <CardActions className="w-full flex justify-center items-end">
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
