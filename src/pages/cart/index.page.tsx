import CheckoutSummary from '@/pages/cart/components/CheckoutSummary';
import CartProductCard from '@/pages/cart/components/ProductCard';
import Layout from '@/pages/components/Layout';
import { fetchWithoutCreds, useFetchWithCreds } from '@/pages/lib/fetch';
import { usePlatform } from '@/pages/lib/PlatformContext';
import { useUserContext } from '@/pages/lib/UserContext';
import { computeProductPrice } from '@/pages/product/utils';
import { cartIndexClasses } from '@/styles/classMaps/cart/index';
import { interClassname } from '@/styles/theme';
import {
  Box,
  Breadcrumbs,
  CardMedia,
  CircularProgress,
  IconButton,
  Link,
  Typography,
} from '@mui/material';
import { CartItem, Prices, Product } from '@prisma/client';
import { GetStaticProps } from 'next';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/router';
import { Suspense, useEffect, useState } from 'react';

// getStaticProps because translations are static
export const getStaticProps = (async (context) => {
  return {
    props: {
      messages: (await import(`../../i18n/${context.locale}.json`)).default,
    },
  };
}) satisfies GetStaticProps<object>;

export default function CartPage() {
  const { user, accessToken, isLoading } = useUserContext();
  const [cartItems, setCartItems] = useState<
    (CartItem & { product: Product })[]
  >([]);
  const [totalPrice, setTotalPrice] = useState(0);
  const router = useRouter();
  const t = useTranslations();
  const fetchWithCreds = useFetchWithCreds();
  const platform = usePlatform();

  const onDelete = (cartItemId: string) => {
    setCartItems(cartItems.filter((cartItem) => cartItem.id !== cartItemId));
  };

  useEffect(() => {
    (async () => {
      if (isLoading) return;
      try {
        const { success, data, message } = user
          ? await fetchWithCreds<(CartItem & { product: Product })[]>({
              accessToken,
              path: `/api/cart?userId=${user.id}`,
              method: 'GET',
            })
          : await fetchWithoutCreds<(CartItem & { product: Product })[]>(
              '/api/guest/cart',
              'GET',
            );

        if (success) {
          const computedData = await Promise.all(
            data.map(async (item) => {
              let computedProduct = item.product;
              if (user && accessToken) {
                computedProduct = await computeProductPrice({
                  product: item.product,
                  accessToken,
                  fetchWithCreds,
                });
              } else {
                const priceMatch = item.product.price?.match(/\[([^\]]+)\]/);
                if (priceMatch) {
                  const priceResp = await fetchWithoutCreds<Prices>(
                    `/api/prices?id=${priceMatch[1]}`,
                    'GET',
                  );
                  if (priceResp.success && priceResp.data?.priceInTmt) {
                    computedProduct = {
                      ...item.product,
                      price: priceResp.data.priceInTmt,
                    };
                  }
                }
              }
              return {
                ...item,
                product: computedProduct,
              };
            }),
          );
          setCartItems(computedData);
        } else {
          console.error(message);
        }
      } catch (error) {
        console.error('Error fetching cart data:', error);
      }
    })();
  }, [user, accessToken, isLoading]);

  useEffect(() => {
    if (cartItems == null) return;
    let totPrice = 0;
    cartItems.forEach((item) => {
      if (!Number.isNaN(Number(item.product.price)))
        totPrice += Number(item.product.price) * item.quantity;
    });
    setTotalPrice(totPrice);
  }, [cartItems]);

  if (isLoading) {
    return (
      <Layout handleHeaderBackButton={() => router.push('/')}>
        <Box className={cartIndexClasses.box[platform]}>
          <Box className="flex justify-center items-center h-full">
            <CircularProgress />
          </Box>
        </Box>
      </Layout>
    );
  }

  return (
    <Layout handleHeaderBackButton={() => router.push('/')}>
      <Box className={cartIndexClasses.box[platform]}>
        <Breadcrumbs
          separator="|"
          maxItems={2}
          className={cartIndexClasses.breadcrumbs[platform]}
        >
          <Link href="/" className={cartIndexClasses.link}>
            <Typography
              className={`${interClassname.className} ${cartIndexClasses.breadcrumbsText} font-regular`}
            >
              {t('home')}
            </Typography>
          </Link>
          <Link href="/cart" className={cartIndexClasses.link}>
            <Typography
              className={`${interClassname.className} ${cartIndexClasses.breadcrumbsText} font-bold`}
            >
              {t('cart')}
            </Typography>
          </Link>
        </Breadcrumbs>
        <Box className={cartIndexClasses.prodCart[platform]}>
          {cartItems != null && cartItems.length > 0 ? (
            <Box className="flex flex-col">
              <Box className={cartIndexClasses.cartHeader[platform]}>
                <Typography
                  className={`${interClassname.className} ${cartIndexClasses.yourCartTypo[platform]}`}
                >
                  {t('cart')}
                </Typography>
                <CheckoutSummary
                  totalPrice={totalPrice}
                  onCheckoutClick={() => router.push('/cart/checkout')}
                />
              </Box>
              <Box className={cartIndexClasses.infoRow[platform]}>
                <Typography
                  className={`${interClassname.className} ${cartIndexClasses.infoRowTypo} w-[38vw] ml-[3vw]`}
                >
                  {t('product').toUpperCase()}
                </Typography>
                <Typography
                  className={`${interClassname.className} ${cartIndexClasses.infoRowTypo} w-[14vw]`}
                >
                  {t('price').toUpperCase()}
                </Typography>
                <Typography
                  className={`${interClassname.className} ${cartIndexClasses.infoRowTypo} w-[14vw]`}
                >
                  {t('quantity').toUpperCase()}
                </Typography>
                <Typography
                  className={`${interClassname.className} ${cartIndexClasses.infoRowTypo} w-[14vw]`}
                >
                  {t('total').toUpperCase()}
                </Typography>
              </Box>
              <Suspense fallback={<CircularProgress />}>
                {cartItems.map((cartItem) => (
                  <CartProductCard
                    product={cartItem?.product}
                    key={cartItem?.id}
                    cartProps={{
                      cartAction: 'delete',
                      quantity: cartItem?.quantity,
                      cartItemId: cartItem?.id,
                      onDelete,
                      setTotalPrice,
                    }}
                  />
                ))}
              </Suspense>
            </Box>
          ) : (
            <Box className="w-full flex flex-col items-center">
              <CardMedia
                component="img"
                src="/cart/empty/emptyCart.png"
                className={cartIndexClasses.emptyCart.img[platform]}
              />
              <Typography
                className={`${interClassname.className} ${cartIndexClasses.emptyCart.typo[platform]}`}
              >
                {t('emptyCart')}
              </Typography>
              <Link
                href="/"
                className={cartIndexClasses.emptyCart.link[platform]}
              >
                <IconButton
                  disableRipple
                  className={`${cartIndexClasses.iconButton[platform]} ${interClassname.className}`}
                >
                  {t('continueShopping')}
                </IconButton>
              </Link>
            </Box>
          )}
        </Box>
      </Box>
    </Layout>
  );
}
