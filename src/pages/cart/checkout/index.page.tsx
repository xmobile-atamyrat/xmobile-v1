import OutOfStockDialog from '@/pages/cart/components/OutOfStockDialog';
import Layout from '@/pages/components/Layout';
import VariantBadge from '@/pages/components/VariantBadge';
import { fetchColors } from '@/pages/lib/apis';
import { OUT_OF_STOCK_ERROR } from '@/pages/lib/constants';
import { fetchWithoutCreds, useFetchWithCreds } from '@/pages/lib/fetch';
import { usePlatform } from '@/pages/lib/PlatformContext';
import { useUserContext } from '@/pages/lib/UserContext';
import { CartItemWithProduct } from '@/pages/lib/types';
import { isCartLineOutOfStock, parseName } from '@/pages/lib/utils';
import {
  computeProductPrice,
  resolveVariantDisplay,
} from '@/pages/product/utils';
import { checkoutDialogClasses } from '@/styles/classMaps/cart/checkoutDialog';
import { colors, interClassname, units } from '@/styles/theme';
import ArrowBackIosIcon from '@mui/icons-material/ArrowBackIos';
import {
  Alert,
  Box,
  Breadcrumbs,
  Button,
  CircularProgress,
  Divider,
  IconButton,
  Link,
  Snackbar,
  TextField,
  Typography,
} from '@mui/material';
import { Color, Prices } from '@prisma/client';
import { GetStaticProps } from 'next';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/router';
import { useCallback, useEffect, useMemo, useState } from 'react';

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

  const [cartItems, setCartItems] = useState<CartItemWithProduct[]>([]);
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
  const [showOutOfStockDialog, setShowOutOfStockDialog] = useState(false);

  useEffect(() => {
    (async () => {
      const cs = await fetchColors();
      setColorsMap(new Map(cs.map((c) => [c.id, c])));
    })();
  }, []);

  // Fetch cart items. Returns the fresh list so callers can react to it —
  // the order handler needs it to recover from a stale out-of-stock cart.
  const loadCartItems = useCallback(async (): Promise<
    CartItemWithProduct[] | null
  > => {
    try {
      const { success, data, message } = user
        ? await fetchWithCreds<CartItemWithProduct[]>({
            accessToken,
            path: `/api/cart?userId=${user.id}`,
            method: 'GET',
          })
        : await fetchWithoutCreds<CartItemWithProduct[]>(
            '/api/guest/cart',
            'GET',
          );

      if (success) {
        setCartItems(data);
        return data;
      }
      console.error(message);
    } catch (error) {
      console.error('Error fetching cart data:', error);
    }
    return null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, accessToken]);

  useEffect(() => {
    loadCartItems();
  }, [loadCartItems]);

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
        // Out-of-stock items can't be ordered, so they don't count toward the total
        const sum = cartItems.reduce(
          (acc, item) =>
            isCartLineOutOfStock(item)
              ? acc
              : acc + (prices[item.id] || 0) * item.quantity,
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

  const outOfStockItems = cartItems.filter(isCartLineOutOfStock);

  // Removes every out-of-stock item so the order can go through
  const handleRemoveOutOfStockItems = async () => {
    const removableIds = outOfStockItems.map((item) => item.id);
    try {
      const results = await Promise.all(
        removableIds.map((cartItemId) =>
          user
            ? fetchWithCreds({
                accessToken,
                path: '/api/cart',
                method: 'DELETE',
                body: { id: cartItemId },
              })
            : fetchWithoutCreds('/api/guest/cart', 'DELETE', {
                id: cartItemId,
              }),
        ),
      );

      const removed = new Set(
        removableIds.filter((_, index) => results[index]?.success),
      );

      if (removed.size > 0) {
        setCartItems((prev) => prev.filter((item) => !removed.has(item.id)));
      }

      if (removed.size < removableIds.length) {
        console.error('Failed to remove some out-of-stock cart items');
        return;
      }

      setShowOutOfStockDialog(false);
    } catch (error) {
      console.error('Error removing out-of-stock cart items:', error);
    }
  };

  const handleOrder = async () => {
    // Out-of-stock items block the order outright — check before anything else
    // so the user isn't asked to fix form fields on an order that can't succeed
    if (outOfStockItems.length > 0) {
      setShowOutOfStockDialog(true);
      return;
    }

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
      const { success, message } = user
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
      } else if (message === OUT_OF_STOCK_ERROR) {
        // A product went out of stock after this page loaded, so local state
        // can't name the offender — refetch before opening the dialog
        const fresh = await loadCartItems();
        if (fresh?.some(isCartLineOutOfStock)) {
          setShowOutOfStockDialog(true);
        } else {
          setSnackbarOpen(true);
        }
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

  const getItemPrice = (item: CartItemWithProduct): number =>
    itemPrices[item.id] ?? 0;

  return (
    <Layout handleHeaderBackButton={() => router.push('/cart')}>
      <Box className={checkoutDialogClasses.dialogContent[platform]}>
        {/* Back button for mobile */}
        {platform === 'mobile' && (
          <Box className="flex flex-row mb-6 items-center">
            <IconButton onClick={() => router.push('/cart')}>
              <ArrowBackIosIcon />
            </IconButton>
            <Box className="flex w-5/6 justify-center">
              <Typography
                className={`${interClassname.className} ${checkoutDialogClasses.title[platform]}`}
              >
                {t('checkout')}
              </Typography>
            </Box>
          </Box>
        )}

        {/* Breadcrumbs for web */}
        {platform === 'web' && (
          <Box>
            <Breadcrumbs
              separator="|"
              className={checkoutDialogClasses.breadcrumbs.web}
            >
              <Link href="/" className="no-underline">
                <Typography
                  className={`${interClassname.className} font-regular text-[16px] leading-[24px] text-[#303030]`}
                >
                  {t('home')}
                </Typography>
              </Link>
              <Link href="/cart" className="no-underline">
                <Typography
                  className={`${interClassname.className} font-regular text-[16px] leading-[24px] text-[#303030]`}
                >
                  {t('cart')}
                </Typography>
              </Link>
              <Typography
                className={`${interClassname.className} font-bold text-[16px] leading-[24px] text-[#303030]`}
              >
                {t('checkout')}
              </Typography>
            </Breadcrumbs>
            {/* Title */}
            <Typography
              className={`${interClassname.className} ${checkoutDialogClasses.title[platform]}`}
            >
              {t('checkout')}
            </Typography>
          </Box>
        )}

        {/* Form Container */}
        <Box className={checkoutDialogClasses.formContainer[platform]}>
          {/* Customer Details */}
          <Box className={checkoutDialogClasses.customerDetails[platform]}>
            {platform === 'web' && (
              <Typography
                className={`${interClassname.className} ${checkoutDialogClasses.sectionTitle.web}`}
              >
                {t('customerDetails')}
              </Typography>
            )}

            {/* Full Name */}
            <Box className={checkoutDialogClasses.fieldContainer[platform]}>
              <Typography
                className={`${interClassname.className} ${checkoutDialogClasses.label[platform]}`}
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
                sx={{
                  '& .MuiOutlinedInput-root': {
                    backgroundColor: 'white',
                    borderRadius: platform === 'web' ? '10px' : '12px',
                    height: units.inputHeight[platform],
                    fontSize: units.inputFontSize[platform],
                    paddingX: platform === 'web' ? '32px' : '16px',
                    paddingY: '16px',
                    '& fieldset': {
                      borderColor: '#303030',
                      opacity: 0.25,
                    },
                    '&:hover fieldset': {
                      borderColor: '#303030',
                      opacity: 0.25,
                    },
                    '&.Mui-focused fieldset': {
                      borderColor: colors.main,
                      opacity: 0.25,
                    },
                  },
                  '& .MuiInputBase-input': {
                    paddingX: platform === 'web' ? '32px' : '16px',
                    paddingY: '16px',
                    fontSize: units.inputFontSize[platform],
                  },
                  '& .MuiInputBase-input::placeholder': {
                    color: colors.placeholder,
                    opacity: 1,
                  },
                }}
              />
            </Box>

            {/* Phone Number */}
            <Box className={checkoutDialogClasses.fieldContainer[platform]}>
              <Typography
                className={`${interClassname.className} ${checkoutDialogClasses.label[platform]}`}
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
                sx={{
                  '& .MuiOutlinedInput-root': {
                    backgroundColor: 'white',
                    borderRadius: platform === 'web' ? '10px' : '12px',
                    height: units.inputHeight[platform],
                    fontSize: units.inputFontSize[platform],
                    paddingX: platform === 'web' ? '32px' : '16px',
                    paddingY: '16px',
                    '& fieldset': {
                      borderColor: '#303030',
                      opacity: 0.25,
                    },
                    '&:hover fieldset': {
                      borderColor: '#303030',
                      opacity: 0.25,
                    },
                    '&.Mui-focused fieldset': {
                      borderColor: colors.main,
                      opacity: 0.25,
                    },
                  },
                  '& .MuiInputBase-input': {
                    paddingX: platform === 'web' ? '32px' : '16px',
                    paddingY: '16px',
                    fontSize: units.inputFontSize[platform],
                  },
                  '& .MuiInputBase-input::placeholder': {
                    color: colors.placeholder,
                    opacity: 1,
                  },
                }}
              />
            </Box>

            {/* Address */}
            <Box className={checkoutDialogClasses.fieldContainer[platform]}>
              <Typography
                className={`${interClassname.className} ${checkoutDialogClasses.label[platform]}`}
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
                sx={{
                  '& .MuiOutlinedInput-root': {
                    backgroundColor: 'white',
                    borderRadius: platform === 'web' ? '10px' : '12px',
                    height: units.inputHeight[platform],
                    fontSize: units.inputFontSize[platform],
                    paddingX: platform === 'web' ? '32px' : '16px',
                    paddingY: '16px',
                    '& fieldset': {
                      borderColor: '#303030',
                      opacity: 0.25,
                    },
                    '&:hover fieldset': {
                      borderColor: '#303030',
                      opacity: 0.25,
                    },
                    '&.Mui-focused fieldset': {
                      borderColor: colors.main,
                      opacity: 0.25,
                    },
                  },
                  '& .MuiInputBase-input': {
                    paddingX: platform === 'web' ? '32px' : '16px',
                    paddingY: '16px',
                    fontSize: units.inputFontSize[platform],
                  },
                  '& .MuiInputBase-input::placeholder': {
                    color: colors.placeholder,
                    opacity: 1,
                  },
                }}
              />
            </Box>

            {/* Order Notes */}
            <Box className={checkoutDialogClasses.fieldContainer[platform]}>
              <Typography
                className={`${interClassname.className} ${checkoutDialogClasses.label[platform]}`}
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
                sx={{
                  '& .MuiOutlinedInput-root': {
                    backgroundColor: 'white',
                    borderRadius: platform === 'web' ? '10px' : '12px',
                    fontSize: units.inputFontSize[platform],
                    paddingX: platform === 'web' ? '32px' : '16px',
                    paddingY: '16px',
                    '& fieldset': {
                      borderColor: '#303030',
                      opacity: 0.25,
                    },
                    '&:hover fieldset': {
                      borderColor: '#303030',
                      opacity: 0.25,
                    },
                    '&.Mui-focused fieldset': {
                      borderColor: colors.main,
                      opacity: 0.25,
                    },
                  },
                  '& .MuiInputBase-input': {
                    paddingX: platform === 'web' ? '32px' : '16px',
                    paddingY: '16px',
                    fontSize: units.inputFontSize[platform],
                  },
                  '& .MuiInputBase-input::placeholder': {
                    color: colors.placeholder,
                    opacity: 1,
                  },
                }}
              />
            </Box>

            {/* Order Button for Mobile */}
            {platform === 'mobile' && (
              <Button
                onClick={handleOrder}
                className={`${interClassname.className} ${checkoutDialogClasses.orderButton.mobile}`}
                sx={{
                  backgroundColor: '#1b1b1b',
                  color: 'white',
                  '&:hover': {
                    backgroundColor: '#000',
                  },
                }}
              >
                {t('order')}
              </Button>
            )}
          </Box>

          {/* Order Summary for Web */}
          {platform === 'web' && (
            <Box className={checkoutDialogClasses.orderSummary.web}>
              {/* Order Items - Scrollable */}
              <Box className="flex flex-col gap-[30px] overflow-y-auto max-h-[600px] pr-2">
                <Typography
                  className={`${interClassname.className} ${checkoutDialogClasses.orderSummaryTitle.web}`}
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
                            className={`${interClassname.className} ${checkoutDialogClasses.orderItemName.web}`}
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
                          className={`${interClassname.className} ${checkoutDialogClasses.orderItemQuantity.web}`}
                        >
                          {item.quantity}
                        </Typography>
                        <Typography
                          className={`${interClassname.className} ${checkoutDialogClasses.orderItemPrice.web}`}
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
                    className={`${interClassname.className} ${checkoutDialogClasses.totalLabel.web}`}
                  >
                    {t('total')}:
                  </Typography>
                  <Typography
                    className={`${interClassname.className} ${checkoutDialogClasses.totalValue.web}`}
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
                  className={`${interClassname.className} ${checkoutDialogClasses.orderButton.web}`}
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
        autoHideDuration={6000}
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

      {showOutOfStockDialog && (
        <OutOfStockDialog
          items={outOfStockItems.map((item) => ({
            id: item.id,
            name: item.product.name,
          }))}
          onClose={() => setShowOutOfStockDialog(false)}
          onRemove={handleRemoveOutOfStockItems}
          onBackToCart={() => router.push('/cart')}
        />
      )}
    </Layout>
  );
}
