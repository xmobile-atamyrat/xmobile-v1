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

  useEffect(() => {
    const fetchUserCartItems = async (userId: string | undefined) => {
      // fix this to redirect to login page
      if (!userId) {
        return;
      }

      try {
        const response = await fetch(`${BASE_URL}/api/cart?userId=${userId}`);
        const data = await response.json();
        // console.log(userId);

        if (data.success) {
          setCartItems(data.data);
        } else {
          // console.log(data);
        }
      } catch (error) {
        /* console.log(error); */
      }
    };
    fetchUserCartItems(user?.id);
  }, [user?.id]);

  /* if (cartItems !== undefined) {
    console.log("cartCellsByUserId: ", cartItems[0]?.productId);
  }
   console.log("productsInUsersCart: ", products);

    if (user != undefined) {
     console.log(user);
   } */

  // console.log(user?.id);
  // useEffect(() => {
  //   const getUserCartItems = async () => {
  //     try {
  //       const res = await fetch(`${BASE_URL}/api/cart?userId=${user?.id}`);
  //       const data = await res.json();

  //       console.log(user?.id);

  //       // if (!data.success) {
  //       //   if (data.message == 'userNotFound') {
  //       //     router.push('user/signin');
  //       //   }
  //       // }
  //     } catch (error) {
  //       console.log(error);
  //     }
  //   }
  //   console.log(getUserCartItems())
  // }, [user?.id]);

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
                }}
              ></ProductCard>
            ))}
        </Box>
      </Box>
    </Layout>
  );
}
