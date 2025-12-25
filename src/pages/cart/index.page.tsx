import CartProductCard from '@/pages/cart/components/ProductCard';
import Layout from '@/pages/components/Layout';
import { PAGENAME } from '@/pages/lib/constants';
import { useFetchWithCreds } from '@/pages/lib/fetch';
import { usePlatform } from '@/pages/lib/PlatformContext';
import { useUserContext } from '@/pages/lib/UserContext';
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
import { CartItem, Product } from '@prisma/client';
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
  const { user, accessToken } = useUserContext();
  const [cartItems, setCartItems] = useState<
    (CartItem & { product: Product })[]
  >([]);
  const router = useRouter();
  const t = useTranslations();
  const fetchWithCreds = useFetchWithCreds();
  const platform = usePlatform();

  const onDelete = (cartItemId: string) => {
    setCartItems(cartItems.filter((cartItem) => cartItem.id !== cartItemId));
  };

  useEffect(() => {
    (async () => {
      // TODO: fix this to redirect to login page
      if (!user) {
        return;
      }

      try {
        const { success, data, message } = await fetchWithCreds<
          (CartItem & { product: Product })[]
        >({ accessToken, path: `/api/cart?userId=${user.id}`, method: 'GET' });

        if (success) {
          setCartItems(data);
        } else {
          console.error(message);
        }
      } catch (error) {
        console.error('Error fetching cart data:', error);
      }
    })();
  }, [user]);

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
        <Box className={cartIndexClasses.prodCart}>
          {cartItems != null && cartItems.length > 0 ? (
            <Box className="flex flex-col">
              <Typography
                className={`${interClassname.className} ${cartIndexClasses.yourCartTypo[platform]}`}
              >
                {t(PAGENAME.cart[platform])}
              </Typography>
              <Box className={cartIndexClasses.infoCol[platform]}>
                <Typography
                  className={`${interClassname.className} ${cartIndexClasses.infoColTypo} w-[32vw] ml-[2.39vw]`}
                >
                  {t('product').toUpperCase()}
                </Typography>
                <Typography
                  className={`${interClassname.className} ${cartIndexClasses.infoColTypo} w-[11vw]`}
                >
                  {t('price').toUpperCase()}
                </Typography>
                <Typography
                  className={`${interClassname.className} ${cartIndexClasses.infoColTypo} w-[8vw]`}
                >
                  {t('quantity').toUpperCase()}
                </Typography>
                <Typography
                  className={`${interClassname.className} ${cartIndexClasses.infoColTypo} ml-[80px]`}
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
                    }}
                  />
                ))}
              </Suspense>
            </Box>
          ) : (
            <Box className="text-center flex flex-col">
              <CardMedia
                component="img"
                src="/emptyCart.png"
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
