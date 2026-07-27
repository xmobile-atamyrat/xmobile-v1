import Layout from '@/pages/components/Layout';
import VariantBadge from '@/pages/components/VariantBadge';
import { fetchColors } from '@/pages/lib/apis';
import { fetchWithoutCreds, useFetchWithCreds } from '@/pages/lib/fetch';
import { usePlatform } from '@/pages/lib/PlatformContext';
import { useUserContext } from '@/pages/lib/UserContext';
import { parseName } from '@/pages/lib/utils';
import {
  computeProductPrice,
  resolveVariantDisplay,
} from '@/pages/product/utils';
import { mobileBottomNavHeight } from '@/pages/lib/constants';
import { checkoutDialogClasses } from '@/styles/classMaps/cart/checkoutDialog';
import {
  colors,
  fontClassName,
  hairline,
  ink,
  muted,
  navy,
  red,
  units,
} from '@/styles/theme';
import {
  Alert,
  Box,
  Breadcrumbs,
  Button,
  CircularProgress,
  Divider,
  Link,
  Snackbar,
  TextField,
  Typography,
} from '@mui/material';
import { CartItem, Color, Prices, Product } from '@prisma/client';
import { GetStaticProps } from 'next';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/router';
import { useEffect, useMemo, useState } from 'react';

// getStaticProps because translations are static
export const getStaticProps = (async (context) => {
  return {
    props: {
      messages: (await import(`../../../i18n/${context.locale}.json`)).default,
    },
  };
}) satisfies GetStaticProps<object>;

export default function CheckoutPage() {
  const t = useTranslations();
  const platform = usePlatform();
  const router = useRouter();
  const { user, accessToken } = useUserContext();
  const fetchWithCreds = useFetchWithCreds();

  const [cartItems, setCartItems] = useState<
    (CartItem & { product: Product })[]
  >([]);
  const [totalPrice, setTotalPrice] = useState(0);
  const [fullName, setFullName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [address, setAddress] = useState('');
  const [notes, setNotes] = useState('');
  // Unit price (TMT) per cart line id — variant-aware
  const [itemPrices, setItemPrices] = useState<Record<string, number>>({});
  const [colorsMap, setColorsMap] = useState<Map<string, Color>>(new Map());
  const [loading, setLoading] = useState(false);
  const [snackbarOpen, setSnackbarOpen] = useState(false);

  useEffect(() => {
    (async () => {
      const cs = await fetchColors();
      setColorsMap(new Map(cs.map((c) => [c.id, c])));
    })();
  }, []);

  // Fetch cart items
  useEffect(() => {
    (async () => {
      try {
        const { success, data, message } = user
          ? await fetchWithCreds<(CartItem & { product: Product })[]>({
              accessToken,
              path: `/api/cart?userId=${user.id}`,
              method: 'GET',
            })
          : await fetchWithoutCreds<(CartItem & { product: Product })[]>(
              '/api/guest/cart',
              'GET',
            );

        if (success) {
          setCartItems(data);
        } else {
          console.error(message);
        }
      } catch (error) {
        console.error('Error fetching cart data:', error);
      }
    })();
  }, [user, accessToken]);

  // Initialize form with user data
  useEffect(() => {
    if (user) {
      setFullName(user.name || '');
      setPhoneNumber(user.phoneNumber || '');
      setAddress(user.address || '');
      setNotes('');
    }
  }, [user]);

  // Memoize cart items signature to prevent infinite loops
  const cartItemsSignature = useMemo(
    () =>
      cartItems
        .map(
          (item) => `${item.id}:${item.selectedVariant ?? ''}:${item.quantity}`,
        )
        .sort()
        .join(','),
    [cartItems],
  );

  // Compute variant-aware unit prices for the order summary
  useEffect(() => {
    if (cartItems.length === 0) {
      setItemPrices({});
      setTotalPrice(0);
      return undefined;
    }

    let cancelled = false;

    (async () => {
      const prices: Record<string, number> = {};
      await Promise.all(
        cartItems.map(async (item) => {
          // Prefer the selected variant's price, fall back to the product price
          const priceSource = item.selectedVariant ?? item.product.price;
          const priceMatch = priceSource?.match(/\[([^\]]+)\]/);
          let unitPrice = 0;

          if (priceMatch) {
            const priceId = priceMatch[1];
            const priceResp =
              user && accessToken
                ? await fetchWithCreds<Prices>({
                    accessToken,
                    path: `/api/prices?id=${priceId}`,
                    method: 'GET',
                  })
                : await fetchWithoutCreds<Prices>(
                    `/api/prices?id=${priceId}`,
                    'GET',
                  );
            if (priceResp.success && priceResp.data?.priceInTmt) {
              unitPrice = parseFloat(priceResp.data.priceInTmt) || 0;
            }
          } else if (user && accessToken) {
            const computedProduct = await computeProductPrice({
              product: item.product,
              accessToken,
              fetchWithCreds,
            });
            if (computedProduct.price && !computedProduct.price.includes('[')) {
              unitPrice = parseFloat(computedProduct.price) || 0;
            }
          }

          if (!cancelled) prices[item.id] = unitPrice;
        }),
      );
      if (!cancelled) {
        setItemPrices(prices);
        const sum = cartItems.reduce(
          (acc, item) => acc + (prices[item.id] || 0) * item.quantity,
          0,
        );
        setTotalPrice(sum);
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cartItemsSignature, accessToken, user]);

  const handleOrder = async () => {
    // Validate required fields
    if (!fullName.trim()) {
      return;
    }
    if (!phoneNumber.trim()) {
      return;
    }
    if (!address.trim()) {
      return;
    }

    setLoading(true);

    try {
      const { success } = user
        ? await fetchWithCreds({
            accessToken,
            path: '/api/order',
            method: 'POST',
            body: {
              deliveryAddress: address.trim(),
              deliveryPhone: phoneNumber.trim(),
              notes: notes.trim() || undefined,
            },
          })
        : await fetchWithoutCreds('/api/guest/order', 'POST', {
            deliveryAddress: address.trim(),
            deliveryPhone: phoneNumber.trim(),
            notes: notes.trim() || undefined,
            userName: fullName.trim(),
          });

      if (success) {
        // Redirect to success page
        router.push('/cart/checkout/success');
      } else {
        // Show error snackbar
        setSnackbarOpen(true);
      }
    } catch (error) {
      console.error('Error creating order:', error);
      setSnackbarOpen(true);
    } finally {
      setLoading(false);
    }
  };

  const getItemPrice = (item: CartItem & { product: Product }): number =>
    itemPrices[item.id] ?? 0;

  // Shared field style — hairline border, navy focus, ink text (design tokens)
  const fieldSx = (multiline = false) => ({
    '& .MuiOutlinedInput-root': {
      backgroundColor: 'white',
      borderRadius: platform === 'web' ? '10px' : '12px',
      ...(multiline ? {} : { height: units.inputHeight[platform] }),
      fontSize: units.inputFontSize[platform],
      '& fieldset': { borderColor: hairline, borderWidth: '1.5px' },
      '&:hover fieldset': { borderColor: muted },
      '&.Mui-focused fieldset': { borderColor: navy, borderWidth: '1.5px' },
    },
    '& .MuiInputBase-input': {
      paddingX: platform === 'web' ? '32px' : '16px',
      paddingY: '16px',
      fontSize: units.inputFontSize[platform],
      color: ink,
    },
    '& .MuiInputBase-input::placeholder': { color: muted, opacity: 1 },
  });

  const isFormIncomplete =
    !fullName.trim() || !phoneNumber.trim() || !address.trim();

  return (
    <Layout handleHeaderBackButton={() => router.push('/cart')}>
      <Box
        className={checkoutDialogClasses.dialogContent[platform]}
        sx={
          platform === 'mobile'
            ? { paddingBottom: `${mobileBottomNavHeight}px` }
            : undefined
        }
      >
        {/* Breadcrumbs for web */}
        {platform === 'web' && (
          <Box>
            <Breadcrumbs
              separator="|"
              className={checkoutDialogClasses.breadcrumbs.web}
            >
              <Link href="/" className="no-underline">
                <Typography
                  className={`${fontClassName.className} font-regular text-[16px] leading-[24px] text-[#303030]`}
                >
                  {t('home')}
                </Typography>
              </Link>
              <Link href="/cart" className="no-underline">
                <Typography
                  className={`${fontClassName.className} font-regular text-[16px] leading-[24px] text-[#303030]`}
                >
                  {t('cart')}
                </Typography>
              </Link>
              <Typography
                className={`${fontClassName.className} font-bold text-[16px] leading-[24px] text-[#303030]`}
              >
                {t('checkout')}
              </Typography>
            </Breadcrumbs>
            {/* Title */}
            <Typography
              className={`${fontClassName.className} ${checkoutDialogClasses.title[platform]}`}
            >
              {t('checkout')}
            </Typography>
          </Box>
        )}

        {/* Form Container */}
        <Box className={checkoutDialogClasses.formContainer[platform]}>
          {/* Customer Details */}
          <Box className={checkoutDialogClasses.customerDetails[platform]}>
            <Typography
              className={`${fontClassName.className} ${checkoutDialogClasses.sectionTitle[platform]}`}
            >
              {t('customerDetails')}
            </Typography>

            {/* Full Name */}
            <Box className={checkoutDialogClasses.fieldContainer[platform]}>
              <Typography
                className={`${fontClassName.className} ${checkoutDialogClasses.label[platform]}`}
              >
                {t('fullName')}{' '}
                <span className={checkoutDialogClasses.required[platform]}>
                  *
                </span>
              </Typography>
              <TextField
                fullWidth
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder={t('fullNamePlaceholder')}
                className={checkoutDialogClasses.textField[platform]}
                sx={fieldSx()}
              />
            </Box>

            {/* Phone Number */}
            <Box className={checkoutDialogClasses.fieldContainer[platform]}>
              <Typography
                className={`${fontClassName.className} ${checkoutDialogClasses.label[platform]}`}
              >
                {t('phoneNumber')}{' '}
                <span className={checkoutDialogClasses.required[platform]}>
                  *
                </span>
              </Typography>
              <TextField
                fullWidth
                required
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                placeholder={t('phoneNumberPlaceholder')}
                className={checkoutDialogClasses.textField[platform]}
                sx={fieldSx()}
              />
            </Box>

            {/* Address */}
            <Box className={checkoutDialogClasses.fieldContainer[platform]}>
              <Typography
                className={`${fontClassName.className} ${checkoutDialogClasses.label[platform]}`}
              >
                {t('addressText')}{' '}
                <span className={checkoutDialogClasses.required[platform]}>
                  *
                </span>
              </Typography>
              <TextField
                fullWidth
                required
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder={t('addressPlaceholder')}
                className={checkoutDialogClasses.textField[platform]}
                sx={fieldSx()}
              />
            </Box>

            {/* Order Notes */}
            <Box className={checkoutDialogClasses.fieldContainer[platform]}>
              <Typography
                className={`${fontClassName.className} ${checkoutDialogClasses.label[platform]}`}
              >
                {t('orderNotes')}
              </Typography>
              <TextField
                fullWidth
                multiline
                rows={platform === 'web' ? 6 : 4}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder={t('orderNotesPlaceholder')}
                className={checkoutDialogClasses.textField[platform]}
                sx={fieldSx(true)}
              />
            </Box>

            {/* Total + Order Button for Mobile */}
            {platform === 'mobile' && (
              <Box className={checkoutDialogClasses.totalContainer.mobile}>
                <Box className={checkoutDialogClasses.totalRow.mobile}>
                  <Typography
                    className={`${fontClassName.className} ${checkoutDialogClasses.totalLabel.mobile}`}
                  >
                    {t('total')}
                  </Typography>
                  <Typography
                    className={`${fontClassName.className} ${checkoutDialogClasses.totalValue.mobile}`}
                  >
                    {totalPrice.toFixed(2)} {t('manat')}
                  </Typography>
                </Box>
                <Button
                  onClick={handleOrder}
                  disabled={loading || isFormIncomplete}
                  className={`${fontClassName.className} ${checkoutDialogClasses.orderButton.mobile}`}
                  sx={{
                    backgroundColor: red,
                    color: 'white',
                    '&:hover': { backgroundColor: '#C6101C' },
                    '&:disabled': { backgroundColor: '#E4E3EB', color: '#fff' },
                  }}
                >
                  {loading ? (
                    <CircularProgress size={22} color="inherit" />
                  ) : (
                    t('order')
                  )}
                </Button>
              </Box>
            )}
          </Box>

          {/* Order Summary for Web */}
          {platform === 'web' && (
            <Box className={checkoutDialogClasses.orderSummary.web}>
              {/* Order Items - Scrollable */}
              <Box className="flex flex-col gap-[30px] overflow-y-auto max-h-[600px] pr-2">
                <Typography
                  className={`${fontClassName.className} ${checkoutDialogClasses.orderSummaryTitle.web}`}
                >
                  {t('orderSummary')}
                </Typography>
                {cartItems.map((item, index) => {
                  const itemTotal = getItemPrice(item) * item.quantity;
                  return (
                    <Box key={item.id}>
                      <Box className={checkoutDialogClasses.orderItem.web}>
                        <Box className="flex flex-col gap-1">
                          <Typography
                            className={`${fontClassName.className} ${checkoutDialogClasses.orderItemName.web}`}
                          >
                            {parseName(
                              item.product.name,
                              router.locale ?? 'tk',
                            )}
                          </Typography>
                          {item.selectedVariant && (
                            <VariantBadge
                              {...resolveVariantDisplay(
                                item.selectedVariant,
                                colorsMap,
                              )}
                            />
                          )}
                        </Box>
                        <Typography
                          className={`${fontClassName.className} ${checkoutDialogClasses.orderItemQuantity.web}`}
                        >
                          {item.quantity}
                        </Typography>
                        <Typography
                          className={`${fontClassName.className} ${checkoutDialogClasses.orderItemPrice.web}`}
                        >
                          {itemTotal.toFixed(2)} {t('manat')}
                        </Typography>
                      </Box>
                      {index < cartItems.length - 1 && (
                        <Divider
                          className={checkoutDialogClasses.divider.web}
                        />
                      )}
                    </Box>
                  );
                })}
              </Box>

              {/* Total */}
              <Box className={checkoutDialogClasses.totalContainer.web}>
                <Box className={checkoutDialogClasses.totalRow.web}>
                  <Typography
                    className={`${fontClassName.className} ${checkoutDialogClasses.totalLabel.web}`}
                  >
                    {t('total')}:
                  </Typography>
                  <Typography
                    className={`${fontClassName.className} ${checkoutDialogClasses.totalValue.web}`}
                  >
                    {totalPrice.toFixed(2)} {t('manat')}
                  </Typography>
                </Box>
                <Button
                  onClick={handleOrder}
                  disabled={
                    loading ||
                    !fullName.trim() ||
                    !phoneNumber.trim() ||
                    !address.trim()
                  }
                  className={`${fontClassName.className} ${checkoutDialogClasses.orderButton.web}`}
                  sx={{
                    backgroundColor: colors.main,
                    color: 'white',
                    '&:hover': {
                      backgroundColor: colors.buttonHoverBg,
                    },
                    '&:disabled': {
                      backgroundColor: '#ccc',
                      color: '#666',
                    },
                  }}
                >
                  {loading ? (
                    <CircularProgress size={24} color="inherit" />
                  ) : (
                    t('orderNow')
                  )}
                </Button>
              </Box>
            </Box>
          )}
        </Box>
      </Box>

      {/* Snackbar for error messages */}
      <Snackbar
        open={snackbarOpen}
        autoHideDuration={3000}
        disableWindowBlurListener
        onClose={(_, reason) => {
          if (reason === 'clickaway') {
            return;
          }
          setSnackbarOpen(false);
        }}
      >
        <Alert
          onClose={() => setSnackbarOpen(false)}
          severity="error"
          variant="filled"
          className="w-100%"
        >
          {t('serverError')}
        </Alert>
      </Snackbar>
    </Layout>
  );
}
