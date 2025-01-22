import BASE_URL from '@/lib/ApiEndpoints';
import Layout from '@/pages/components/Layout';
import ProductCard from '@/pages/components/ProductCard';
import { appBarHeight, mobileAppBarHeight } from '@/pages/lib/constants';
import { useUserContext } from '@/pages/lib/UserContext';
import {
  Box,
  Typography,
  useMediaQuery,
  useTheme,
  Link,
  IconButton,
  Breadcrumbs,
  CircularProgress,
} from '@mui/material';
import { GetStaticProps } from 'next';
import { useRouter } from 'next/router';
import { Suspense, useEffect, useState } from 'react';
import HomeIcon from '@mui/icons-material/Home';
import { useTranslations } from 'next-intl';

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
  const { user } = useUserContext();
  const [cartItems, setCartItems] = useState([]);
  const router = useRouter();
  const t = useTranslations();

  const onDelete = (cartItemId: string) => {
    setCartItems(cartItems.filter((cartItem) => cartItem.id !== cartItemId));
  };

  useEffect(() => {
    const fetchUserCartItems = async (userId: string | undefined) => {
      // TODO: fix this to redirect to login page
      if (!userId) {
        return;
      }

      try {
        const response = await fetch(`${BASE_URL}/api/cart?userId=${userId}`);
        const data = await response.json();

        if (data.success) {
          setCartItems(data.data);
        } else {
          console.error(data.message);
        }
      } catch (error) {
        console.error('Error fetching cart data:', error);
      }
    };
    fetchUserCartItems(user?.id);
  }, [user?.id]);

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
