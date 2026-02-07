import Layout from '@/pages/components/Layout';
import { useFetchWithCreds } from '@/pages/lib/fetch';
import { usePlatform } from '@/pages/lib/PlatformContext';
import { useUserContext } from '@/pages/lib/UserContext';
import { parseName } from '@/pages/lib/utils';
import {
  computeProductPrice,
  computeVariantColor,
  computeVariantPrice,
  extractColorIdFromTag,
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
import { CartItem, Product } from '@prisma/client';
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
    (CartItem & {
      product: Product;
      color?: { id: string; name: string; hex: string };
    })[]
  >([]);
  const [totalPrice, setTotalPrice] = useState(0);
  const [fullName, setFullName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [address, setAddress] = useState('');
  const [notes, setNotes] = useState('');
  // Computed prices for each cart item (keyed by item.id)
  const [computedItemPrices, setComputedItemPrices] = useState<
    Record<string, number>
  >({});
  const [loading, setLoading] = useState(false);
  const [snackbarOpen, setSnackbarOpen] = useState(false);

  // Fetch cart items
  useEffect(() => {
    (async () => {
      if (!user || !accessToken) {
        return;
      }

      try {
        const { success, data, message } = await fetchWithCreds<
          (CartItem & { product: Product })[]
        >({ accessToken, path: `/api/cart?userId=${user.id}`, method: 'GET' });

        if (success) {
          const itemsWithColor = await Promise.all(
            data.map(async (item) => {
              let color;
              if (item.selectedTag) {
                const colorId = extractColorIdFromTag(item.selectedTag);
                if (colorId) {
                  const colorData = await computeVariantColor({
                    tag: item.selectedTag,
                    accessToken,
                    fetchWithCreds,
                  });
                  if (colorData) {
                    color = {
                      id: colorData.id,
                      name: colorData.name,
                      hex: colorData.hex,
                    };
                  }
                }
              }
              return { ...item, color };
            }),
          );
          setCartItems(itemsWithColor);
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
          (item) =>
            `${item.id}:${item.product.id}:${item.quantity}:${item.selectedTag || ''}`,
        )
        .sort()
        .join(','),
    [cartItems],
  );

  // Compute prices for each item
  useEffect(() => {
    if (!accessToken || cartItems.length === 0) {
      setComputedItemPrices({});
      setTotalPrice(0);
      return undefined;
    }

    let cancelled = false;

    (async () => {
      const newComputedPrices: Record<string, number> = {};

      await Promise.all(
        cartItems.map(async (item) => {
          if (cancelled) return;

          let price = 0;

          if (item.selectedTag) {
            const variantPrice = await computeVariantPrice({
              tag: item.selectedTag,
              accessToken,
              fetchWithCreds,
            });
            if (variantPrice !== null) {
              price = variantPrice;
            }
          }

          if (price === 0) {
            const computedProduct = await computeProductPrice({
              product: item.product,
              accessToken,
              fetchWithCreds,
            });
            const priceStr = computedProduct.price;
            if (priceStr && !priceStr.includes('[')) {
              const p = parseFloat(priceStr);
              if (!Number.isNaN(p)) {
                price = p;
              }
            }
          }

          if (!cancelled) {
            newComputedPrices[item.id] = price;
          }
        }),
      );

      if (!cancelled) {
        setComputedItemPrices(newComputedPrices);

        // Calculate total price
        let sum = 0;
        cartItems.forEach((item) => {
          const itemPrice = newComputedPrices[item.id] || 0;
          sum += itemPrice * item.quantity;
        });
        setTotalPrice(sum);
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cartItemsSignature, accessToken]);

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
      const { success } = await fetchWithCreds({
        accessToken,
        path: '/api/order',
        method: 'POST',
        body: {
          deliveryAddress: address.trim(),
          deliveryPhone: phoneNumber.trim(),
          notes: notes.trim() || undefined,
        },
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

  const getItemPrice = (itemId: string): number => {
    return computedItemPrices[itemId] || 0;
  };

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
                  const productPrice = getItemPrice(item.id);
                  const itemTotal = productPrice * item.quantity;
                  return (
                    <Box key={item.id}>
                      <Box className={checkoutDialogClasses.orderItem.web}>
                        <Typography
                          className={`${interClassname.className} ${checkoutDialogClasses.orderItemName.web}`}
                        >
                          {parseName(item.product.name, router.locale ?? 'tk')}
                        </Typography>
                        {item.selectedTag && (
                          <Box className="flex flex-row items-center gap-1">
                            <Typography
                              className={`${interClassname.className} text-xs text-gray-500`}
                            >
                              {item.selectedTag
                                .replace(/\[[^\]]*\]|\{[^}]*\}|tmt/gi, '')
                                .trim()}
                              {item.color && ` (${item.color.name})`}
                            </Typography>
                            {item.color && (
                              <Box
                                sx={{
                                  width: 12,
                                  height: 12,
                                  borderRadius: '50%',
                                  backgroundColor: item.color.hex,
                                  border: '1px solid #ddd',
                                }}
                              />
                            )}
                          </Box>
                        )}
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
    </Layout>
  );
}
