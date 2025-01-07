import Layout from '@/pages/components/Layout';
import SimpleBreadcrumbs from '@/pages/components/SimpleBreadcrumbs';
import { appBarHeight, mobileAppBarHeight } from '@/pages/lib/constants';
import { useMediaQuery, useTheme, Box } from '@mui/material';
import { GetStaticProps } from 'next';
import { useUserContext } from '@/pages/lib/UserContext';
import ProductCard from '@/pages/components/ProductCard';
import BASE_URL from '@/lib/ApiEndpoints';
import { useEffect, useState } from 'react';

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
  const [cartItems, setCartItems] = useState<any[]>([]);

  const onDelete = (cartItemId: string) => {
    // brother is it okay to filter out not deleted cartItems?
    // bcoz everytime when one product is deleted it will go through each of them
    setCartItems(cartItems.filter((cartItem) => cartItem.id !== cartItemId));
  };

  useEffect(() => {
    const fetchUserCartItems = async (userId: string | undefined) => {
      // fix this to redirect to login page
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
    <Layout>
      <Box
        className="w-full h-full flex flex-col"
        sx={{
          mt: isMdUp ? `${appBarHeight}px` : `${mobileAppBarHeight}px`,
        }}
      >
        <SimpleBreadcrumbs />
        <Box className="flex flex-wrap gap-4 w-full p-3">
          {cartItems !== null &&
            cartItems?.length > 0 &&
            cartItems?.map((cartItem, idx) => (
              <ProductCard
                product={cartItem?.product}
                key={idx}
                cartProps={{
                  cartAction: 'delete',
                  quantity: cartItem?.quantity,
                  cartItemId: cartItem?.id,
                  onDelete,
                }}
              ></ProductCard>
            ))}
        </Box>
      </Box>
    </Layout>
  );
}
