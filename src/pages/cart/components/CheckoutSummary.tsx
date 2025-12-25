import { useFetchWithCreds } from '@/pages/lib/fetch';
import { usePlatform } from '@/pages/lib/PlatformContext';
import { useUserContext } from '@/pages/lib/UserContext';
import { computeProductPrice } from '@/pages/product/utils';
import { cartCheckoutClasses } from '@/styles/classMaps/cart/checkout';
import { colors, interClassname } from '@/styles/theme';
import { Box, Button, Typography } from '@mui/material';
import { CartItem, Product } from '@prisma/client';
import { useTranslations } from 'next-intl';
import { useEffect, useMemo, useState } from 'react';

interface CheckoutSummaryProps {
  cartItems: (CartItem & { product: Product })[];
}

export default function CheckoutSummary({ cartItems }: CheckoutSummaryProps) {
  const t = useTranslations();
  const platform = usePlatform();
  const { accessToken } = useUserContext();
  const fetchWithCreds = useFetchWithCreds();
  const [computedProducts, setComputedProducts] = useState<
    Record<string, Product>
  >({});

  // Memoize cart item IDs to prevent infinite loops
  const cartItemIds = useMemo(
    () => cartItems.map((item) => item.product.id).join(','),
    [cartItems],
  );

  // Compute prices for all cart items
  useEffect(() => {
    if (!accessToken || cartItems.length === 0) {
      setComputedProducts({});
      return undefined;
    }

    let cancelled = false;

    (async () => {
      const computed: Record<string, Product> = {};
      await Promise.all(
        cartItems.map(async (item) => {
          if (!cancelled && !computed[item.product.id]) {
            const computedProduct = await computeProductPrice({
              product: item.product,
              accessToken,
              fetchWithCreds,
            });
            if (!cancelled) {
              computed[item.product.id] = computedProduct;
            }
          }
        }),
      );
      if (!cancelled) {
        setComputedProducts(computed);
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cartItemIds, accessToken]);

  // Calculate subtotal from cart items with computed prices
  const calculateSubtotal = () => {
    let subtotal = 0;
    cartItems.forEach((item) => {
      const product = computedProducts[item.product.id] || item.product;
      const priceStr = product.price;
      if (priceStr && !priceStr.includes('[')) {
        // Price is already computed (has value, not ID)
        const price = parseFloat(priceStr);
        if (!Number.isNaN(price)) {
          subtotal += price * item.quantity;
        }
      }
    });
    return subtotal;
  };

  const subtotal = calculateSubtotal();

  return (
    <Box className={cartCheckoutClasses.container[platform]}>
      <Box className={cartCheckoutClasses.summaryBox[platform]}>
        <Box className={cartCheckoutClasses.subtotalRow[platform]}>
          <Typography
            className={`${interClassname.className} ${cartCheckoutClasses.subtotalLabel[platform]}`}
          >
            {t('totalAmount')}:
          </Typography>
          <Typography
            className={`${interClassname.className} ${cartCheckoutClasses.subtotalValue[platform]}`}
            sx={{
              color: platform === 'web' ? colors.main : '#1b1b1b',
            }}
          >
            {subtotal.toFixed(2)} TMT
          </Typography>
        </Box>
        <Button
          className={cartCheckoutClasses.checkoutButton[platform]}
          sx={{
            backgroundColor: colors.main,
            color: colors.white,
            '&:hover': {
              backgroundColor:
                platform === 'web'
                  ? colors.buttonHoverBg.web
                  : colors.buttonHoverBg.mobile,
            },
          }}
        >
          <Typography
            className={`${interClassname.className} ${cartCheckoutClasses.checkoutButtonText[platform]}`}
          >
            {t('checkout')}
          </Typography>
        </Button>
      </Box>
    </Box>
  );
}
