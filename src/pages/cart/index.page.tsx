import Layout from '@/pages/components/Layout';
import ProductCard from '@/pages/components/ProductCard';
import { appBarHeight, mobileAppBarHeight } from '@/pages/lib/constants';
import { useFetchWithCreds } from '@/pages/lib/fetch';
import { useUserContext } from '@/pages/lib/UserContext';
import HomeIcon from '@mui/icons-material/Home';
import {
  Box,
  Breadcrumbs,
  CircularProgress,
  IconButton,
  Link,
  Typography,
  useMediaQuery,
  useTheme,
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
  const theme = useTheme();
  const isMdUp = useMediaQuery(theme.breakpoints.up('md'));
  const { user, accessToken } = useUserContext();
  const [cartItems, setCartItems] = useState<
    (CartItem & { product: Product })[]
  >([]);
  const router = useRouter();
  const t = useTranslations();
  const fetchWithCreds = useFetchWithCreds();

  const onDelete = (cartItemId: string) => {
    setCartItems(cartItems.filter((cartItem) => cartItem.id !== cartItemId));
  };

  useEffect(() => {
    (async () => {
      // TODO: fix this to redirect to login page
      if (!user.id) {
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
      <Box
        className="w-full h-full flex flex-col"
        sx={{
          mt: isMdUp ? `${appBarHeight}px` : `${mobileAppBarHeight}px`,
        }}
      >
        <Breadcrumbs separator="›" maxItems={2} className="ml-3">
          <Link
            href="/"
            className="flex fle-row justify-center items-center gap-1 py-2"
          >
            <HomeIcon sx={{ fontSize: 18 }} />
            <Typography fontSize={15}>{t('home')}</Typography>
          </Link>
          <Link href="/cart">
            <Typography>{t('cart')}</Typography>
          </Link>
        </Breadcrumbs>

        <Box className="flex flex-wrap gap-4 w-full p-3">
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
                <IconButton className="mt-2 px-4 py-2 bg-blue-500 text-white text-sm rounded hover:bg-blue-600">
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
