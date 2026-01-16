import CheckoutSummary from '@/pages/cart/components/CheckoutSummary';
import CartProductCard from '@/pages/cart/components/ProductCard';
import Layout from '@/pages/components/Layout';
import { useFetchWithCreds } from '@/pages/lib/fetch';
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
import { CartItem, Product } from '@prisma/client';
import { GetStaticProps } from 'next';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/router';
import { Suspense, useEffect, useState } from 'react';

// getStaticProps because translations are static
export const getStaticProps = (async () => {
  // For static export, we can't rely on context.locale (Next.js i18n)
  // Load default locale messages at build time
  // Client-side will switch locale based on cookie
  const defaultLocale = 'ru';
  let messages = {};
  try {
    messages = (await import(`../../i18n/${defaultLocale}.json`)).default;
  } catch (error) {
    console.error('Error loading messages:', error);
  }

  return {
    props: {
      messages,
      // Also load all locale messages so client can switch without page reload
      allMessages: {
        en: (await import('../../i18n/en.json')).default,
        ru: (await import('../../i18n/ru.json')).default,
        tk: (await import('../../i18n/tk.json')).default,
        ch: (await import('../../i18n/ch.json')).default,
        tr: (await import('../../i18n/tr.json')).default,
      },
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
    if (isLoading) {
      return;
    }
    if (!user) {
      router.push('/user/sign_in_up');
    }
  }, [user, isLoading, router]);

  useEffect(() => {
    (async () => {
      if (!user) {
        return;
      }

      try {
        const { success, data, message } = await fetchWithCreds<
          (CartItem & { product: Product })[]
        >({ accessToken, path: `/api/cart?userId=${user.id}`, method: 'GET' });

        if (success) {
          const computedData = await Promise.all(
            data.map(async (item) => {
              const computedProduct = await computeProductPrice({
                product: item.product,
                accessToken,
                fetchWithCreds,
              });
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
  }, [user]);

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
