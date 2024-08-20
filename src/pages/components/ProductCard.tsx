import BASE_URL from '@/lib/ApiEndpoints';
import { fetchProducts } from '@/pages/lib/apis';
import { POLL_PRODUCT_INTERVAL } from '@/pages/lib/constants';
import { useProductContext } from '@/pages/lib/ProductContext';
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
import { useEffect, useState } from 'react';

interface ProductCardProps {
  product?: Product;
  handleClickAddProduct?: () => void;
  cardClassName?: string;
}

export default function ProductCard({
  product: initialProduct,
  handleClickAddProduct,
  cardClassName,
}: ProductCardProps) {
  const t = useTranslations();
  const router = useRouter();
  const { setSelectedProduct } = useProductContext();
  const [imgUrl, setImgUrl] = useState<string | null>();
  const [product, setProduct] = useState(initialProduct);
  const theme = useTheme();
  const isMdUp = useMediaQuery(theme.breakpoints.up('md'));

  useEffect(() => {
    (async () => {
      if (product?.imgUrls[0] != null) {
        setImgUrl('/xmobile-original-logo.jpeg');
        if (product.imgUrls[0].startsWith('http')) {
          setImgUrl(product.imgUrls[0]);
        } else {
          const imgFetcher = fetch(
            `${BASE_URL}/api/localImage?imgUrl=${product.imgUrls[0]}`,
          );

          setImgUrl(URL.createObjectURL(await (await imgFetcher).blob()));
        }
      }
    })();
  }, [product?.imgUrls]);

  useEffect(() => {
    if (initialProduct == null) return () => undefined;

    (async () => {
      setProduct(await computeProductPrice(initialProduct));
    })();

    const fetchProduct = async () => {
      try {
        const prod = await fetchProducts({ productId: initialProduct.id });
        setProduct(await computeProductPrice(prod[0]));
      } catch (error) {
        console.error('Error fetching product', error);
      }
    };

    const intervalId = setInterval(fetchProduct, POLL_PRODUCT_INTERVAL);

    return () => clearInterval(intervalId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialProduct]);

  return (
    <Card
      sx={{
        width: { xs: '47%', sm: 200 },
        height: { xs: 300, sm: 350 },
        ':hover': { boxShadow: 10 },
      }}
      className={classNames('border-[1px] px-2 py-2 relative', cardClassName)}
    >
      {product != null ? (
        <Box
          className="relative h-full w-full flex flex-col justify-between p-1"
          onClick={() => {
            setSelectedProduct(initialProduct);
            router.push(`/product`);
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
                    height: { xs: 120 },
                    width: 'auto',
                    p: 0,
                  }}
                />
              </Box>
            )}
            <Box>
              <Typography
                gutterBottom
                sx={{ fontSize: { xs: 16, sm: 20 }, mt: 1 }}
                component="div"
              >
                {parseName(product.name, router.locale ?? 'tk').substring(
                  0,
                  24,
                )}
              </Typography>
            </Box>
            <Box
              className={`w-full overflow-y-scroll overflow-x-hidden ${product.imgUrls[0] != null ? 'h-1/4' : 'h-3/5'}`}
            >
              {parseName(product.description ?? '{}', router.locale ?? 'tk')
                ?.split('\n')
                ?.map((desc, index) => (
                  <Typography
                    key={`${desc}-${index}`}
                    variant="body2"
                    color="text.secondary"
                  >
                    {desc}
                  </Typography>
                ))}
            </Box>
          </Box>
          <Box className="flex items-end ">
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
          </Box>
        </Box>
      ) : (
        <Box className="w-full h-full flex flex-col justify-between">
          <CardContent>
            <Typography gutterBottom className="flex justify-center">
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
                <AddCircleIcon fontSize="small" color="primary" />
              </IconButton>
            </CardActions>
          </Box>
        </Box>
      )}
    </Card>
  );
}
