import Layout from '@/pages/components/Layout';
import ProductCard from '@/pages/components/ProductCard';
import { useFetchWithCreds } from '@/pages/lib/fetch';
import { usePlatform } from '@/pages/lib/PlatformContext';
import { useUserContext } from '@/pages/lib/UserContext';
import { cartIndexClasses } from '@/styles/classMaps/cart/index.page';
import HomeIcon from '@mui/icons-material/Home';
import {
  Box,
  Breadcrumbs,
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
        <Breadcrumbs separator="›" maxItems={2} className="ml-3">
          <Link href="/" className={cartIndexClasses.link}>
            <HomeIcon className="text-lg" />
            <Typography fontSize={15}>{t('home')}</Typography>
          </Link>
          <Link href="/cart">
            <Typography>{t('cart')}</Typography>
          </Link>
        </Breadcrumbs>

        <Box className={cartIndexClasses.prodCart}>
          {cartItems != null && cartItems.length > 0 ? (
            <Suspense fallback={<CircularProgress />}>
              {cartItems.map((cartItem, idx) => (
                <ProductCard
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
          ) : (
            <Box className="text-center w-full">
              <Link href="/">
                <IconButton className={cartIndexClasses.iconButton}>
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
