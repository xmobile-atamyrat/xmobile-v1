import Layout from '@/pages/components/Layout';
import { useFetchWithCreds } from '@/pages/lib/fetch';
import { usePlatform } from '@/pages/lib/PlatformContext';
import { useUserContext } from '@/pages/lib/UserContext';
import { checkoutSuccessClasses } from '@/styles/classMaps/cart/checkoutSuccess';
import { colors, interClassname } from '@/styles/theme';
import { Box, Button, Typography } from '@mui/material';
import { GetStaticProps } from 'next';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';

// getStaticProps because translations are static
export const getStaticProps = (async (context) => {
  return {
    props: {
      messages: (await import(`../../../i18n/${context.locale}.json`)).default,
    },
  };
}) satisfies GetStaticProps<object>;

export default function CheckoutSuccessPage() {
  const t = useTranslations();
  const platform = usePlatform();
  const router = useRouter();
  const { user, accessToken } = useUserContext();
  const fetchWithCreds = useFetchWithCreds();
  const [orderNumber, setOrderNumber] = useState<string | null>(null);

  // Fetch the most recent order to get order number
  useEffect(() => {
    (async () => {
      if (!user || !accessToken) {
        return;
      }

      try {
        const { success, data } = await fetchWithCreds<{
          orders: Array<{ orderNumber: string }>;
          pagination?: unknown;
        }>({
          accessToken,
          path: '/api/order?limit=1', // get the last order
          method: 'GET',
        });

        if (success && data?.orders && data.orders.length > 0) {
          setOrderNumber(data.orders[0].orderNumber);
        }
      } catch (error) {
        console.error('Error fetching order:', error);
      }
    })();
  }, [user, accessToken, fetchWithCreds]);

  return (
    <Layout handleHeaderBackButton={() => router.push('/')}>
      <Box className={checkoutSuccessClasses.container[platform]}>
        {/* Success Image/Icon */}
        <Box className={checkoutSuccessClasses.imageContainer[platform]}>
          <img
            src={
              platform === 'web'
                ? '/cart/checkout/success.svg'
                : '/cart/checkout/success_mobile.svg'
            }
            className={checkoutSuccessClasses.image[platform]}
            alt="Cart Checkout Success"
          />
        </Box>

        {/* Title */}
        <Typography
          className={`${interClassname.className} ${checkoutSuccessClasses.title[platform]}`}
        >
          {platform === 'web' ? t('successfullyOrdered') : t('thankYou')}
        </Typography>

        {/* Message */}
        <Box className={checkoutSuccessClasses.message[platform]}>
          <Typography
            className={`${interClassname.className} ${checkoutSuccessClasses.yourOrder[platform]}`}
          >
            {t('yourOrder')}{' '}
            {orderNumber && (
              <span
                className={`${interClassname.className} ${checkoutSuccessClasses.orderNumber[platform]}`}
              >
                {orderNumber}
              </span>
            )}{' '}
            {t('isCompleted')}
          </Typography>
          <Typography
            className={`${interClassname.className} ${checkoutSuccessClasses.confirmation[platform]}`}
          >
            {t('waitForConfirmation')}
          </Typography>
        </Box>

        {/* Buttons */}
        <Box className="flex flex-row gap-2 w-full justify-center">
          <Button
            onClick={() => router.push('/')}
            className={`${interClassname.className} ${checkoutSuccessClasses.button[platform]}`}
            sx={{
              backgroundColor: platform === 'web' ? colors.main : '#1b1b1b',
              color: 'white',
              '&:hover': {
                backgroundColor:
                  platform === 'web' ? colors.buttonHoverBg : '#000',
              },
            }}
          >
            {t('products')}
          </Button>
          <Button
            onClick={() => router.push('/orders')}
            className={`${interClassname.className} ${checkoutSuccessClasses.button[platform]}`}
            sx={{
              backgroundColor: platform === 'web' ? colors.main : '#1b1b1b',
              color: 'white',
              '&:hover': {
                backgroundColor:
                  platform === 'web' ? colors.buttonHoverBg : '#000',
              },
            }}
          >
            {t('myOrders')}
          </Button>
        </Box>
      </Box>
    </Layout>
  );
}
