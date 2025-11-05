import CartProductCard from '@/pages/cart/components/ProductCard';
import Layout from '@/pages/components/Layout';
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
        router.push('/');
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
            <Box>
              <Typography
                className={`${interClassname.className} font-bold text-[56px] leading-[68px] tracking-normal text-[#303030] mb-[1.3vw]`}
              >
                {t('yourCart')}
              </Typography>
              <Box className="flex flex-row w-[79.16vw] h-[88px] rounded-[15px] bg-[#f4f4f4] items-center">
                <Typography
                  className={`${interClassname.className} font-bold text-[16px] leading-[24px] tracking-normal text-[#303030] ml-[2.9vw]`}
                >
                  {t('product').toUpperCase()}
                </Typography>
                <Typography
                  className={`${interClassname.className} font-bold text-[16px] leading-[24px] tracking-normal text-[#303030] ml-[31.875vw]`}
                >
                  {t('price').toUpperCase()}
                </Typography>
                <Typography
                  className={`${interClassname.className} font-bold text-[16px] leading-[24px] tracking-normal text-[#303030] ml-[9.11vw]`}
                >
                  {t('quantity').toUpperCase()}
                </Typography>
                <Typography
                  className={`${interClassname.className} font-bold text-[16px] leading-[24px] tracking-normal text-[#303030] ml-[7.86vw]`}
                >
                  {t('total').toUpperCase()}
                </Typography>
              </Box>
              <Suspense fallback={<CircularProgress />}>
                {cartItems.map((cartItem, idx) => (
                  <CartProductCard
                    product={cartItem?.product}
                    key={idx}
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
            <Box className="text-center w-full">
              <CardMedia
                component="img"
                src="/emptyCart.png"
                className="w-[22.34vw] h-[18.64vw] mx-auto my-[3.9vw]"
              />
              <Typography
                className={`${interClassname.className} font-medium text-[30px] leading-[24px] tracking-normal text-[#000] text-center mb-[3.125vw]`}
              >
                {t('emptyCart')}
              </Typography>
              <Link
                href="/"
                className="min-w-[11.875vw] h-[3.22vw] bg-[#ff624c] rounded-[10px] py-[16px] px-[40px] gap-[10px]"
              >
                <IconButton
                  disableRipple
                  className={`${cartIndexClasses.iconButton} ${interClassname.className}`}
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
