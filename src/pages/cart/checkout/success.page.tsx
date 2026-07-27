import Layout from '@/pages/components/Layout';
import { fetchWithoutCreds, useFetchWithCreds } from '@/pages/lib/fetch';
import { usePlatform } from '@/pages/lib/PlatformContext';
import { useUserContext } from '@/pages/lib/UserContext';
import { checkoutSuccessClasses } from '@/styles/classMaps/cart/checkoutSuccess';
import { colors, fontClassName, navy } from '@/styles/theme';
import { Box, Button, Typography } from '@mui/material';
import { Check } from 'lucide-react';
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
        if (user && accessToken) {
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
        } else {
          const guestResp = await fetchWithoutCreds<
            Array<{ orderNumber: string }>
          >('/api/guest/order', 'GET');
          if (
            guestResp.success &&
            guestResp.data &&
            guestResp.data.length > 0
          ) {
            setOrderNumber(guestResp.data[0].orderNumber);
          }
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
        {platform === 'mobile' ? (
          <Box className={checkoutSuccessClasses.badgeOuter.mobile}>
            <Box className={checkoutSuccessClasses.badgeInner.mobile}>
              <Check size={34} color="#fff" strokeWidth={2.5} />
            </Box>
          </Box>
        ) : (
          <Box className={checkoutSuccessClasses.imageContainer.web}>
            <img
              src="/cart/checkout/success.svg"
              className={checkoutSuccessClasses.image.web}
              alt="Cart Checkout Success"
            />
          </Box>
        )}

        {/* Title */}
        <Typography
          className={`${fontClassName.className} ${checkoutSuccessClasses.title[platform]}`}
        >
          {platform === 'web' ? t('successfullyOrdered') : t('thankYou')}
        </Typography>

        {/* Message */}
        <Box className={checkoutSuccessClasses.message[platform]}>
          <Typography
            className={`${fontClassName.className} ${checkoutSuccessClasses.yourOrder[platform]}`}
          >
            {t('yourOrder')}{' '}
            {orderNumber && (
              <span
                className={`${fontClassName.className} ${checkoutSuccessClasses.orderNumber[platform]}`}
              >
                {orderNumber}
              </span>
            )}{' '}
            {t('isCompleted')}
          </Typography>
          <Typography
            className={`${fontClassName.className} ${checkoutSuccessClasses.confirmation[platform]}`}
          >
            {t('waitForConfirmation')}
          </Typography>
        </Box>

        {/* Buttons */}
        <Box className={checkoutSuccessClasses.buttonContainer[platform]}>
          {platform === 'mobile' ? (
            <>
              <Button
                onClick={() => router.push('/orders')}
                className={`${fontClassName.className} ${checkoutSuccessClasses.buttonPrimary.mobile}`}
                sx={{
                  backgroundColor: navy,
                  color: 'white',
                  '&:hover': { backgroundColor: colors.buttonHoverBg },
                }}
              >
                {t('myOrders')}
              </Button>
              <Button
                onClick={() => router.push('/')}
                className={`${fontClassName.className} ${checkoutSuccessClasses.buttonSecondary.mobile}`}
                sx={{ color: navy }}
              >
                {t('continueShopping')}
              </Button>
            </>
          ) : (
            <>
              <Button
                onClick={() => router.push('/')}
                className={`${fontClassName.className} ${checkoutSuccessClasses.button.web}`}
                sx={{
                  backgroundColor: colors.main,
                  color: 'white',
                  '&:hover': { backgroundColor: colors.buttonHoverBg },
                }}
              >
                {t('products')}
              </Button>
              <Button
                onClick={() => router.push('/orders')}
                className={`${fontClassName.className} ${checkoutSuccessClasses.button.web}`}
                sx={{
                  backgroundColor: colors.main,
                  color: 'white',
                  '&:hover': { backgroundColor: colors.buttonHoverBg },
                }}
              >
                {t('myOrders')}
              </Button>
            </>
          )}
        </Box>
      </Box>
    </Layout>
  );
}
