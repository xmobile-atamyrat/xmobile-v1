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
  Checkbox,
  CircularProgress,
  Divider,
  FormControlLabel,
  IconButton,
  Link,
  Snackbar,
  TextField,
  Typography,
} from '@mui/material';
import { CartItem, Color, Prices, Product } from '@prisma/client';
import { Banknote, Pencil, Truck } from 'lucide-react';
import { GetStaticProps } from 'next';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/router';
import { Fragment, useEffect, useMemo, useState } from 'react';

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
  const [snackbarMsg, setSnackbarMsg] = useState('serverError');
  // Address card: saved (collapsed) vs edit (fields). Guests/no-address start editing.
  const [editingAddress, setEditingAddress] = useState(true);
  const [saveToProfile, setSaveToProfile] = useState(false);
  // Wizard: 0=Address 1=Delivery 2=Payment 3=Review
  const [currentStep, setCurrentStep] = useState(0);
  // Set once the user tries to advance past the address step incomplete.
  const [attemptedNext, setAttemptedNext] = useState(false);

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
      // Collapse to the saved-address card only when every required field is
      // present — otherwise the user would be stuck behind a card Next rejects.
      setEditingAddress(
        !(
          (user.address || '').trim() &&
          (user.name || '').trim() &&
          (user.phoneNumber || '').trim()
        ),
      );
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
              updateAddress: saveToProfile,
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
        setSnackbarMsg('serverError');
        setSnackbarOpen(true);
      }
    } catch (error) {
      console.error('Error creating order:', error);
      setSnackbarMsg('serverError');
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
      '&.Mui-error fieldset': { borderColor: red, borderWidth: '1.5px' },
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

  const cls = checkoutDialogClasses;
  const fc = fontClassName.className;

  // Shared labeled field (used by both web form and mobile edit card)
  const renderField = (opts: {
    label: string;
    value: string;
    onChange: (v: string) => void;
    placeholder: string;
    required?: boolean;
    multiline?: boolean;
    error?: boolean;
  }) => {
    const multilineRows = platform === 'web' ? 6 : 4;
    return (
      <Box className={cls.fieldContainer[platform]}>
        <Typography className={`${fc} ${cls.label[platform]}`}>
          {opts.label}
          {opts.required && <span className={cls.required[platform]}> *</span>}
        </Typography>
        <TextField
          fullWidth
          required={opts.required}
          error={opts.error}
          multiline={opts.multiline}
          rows={opts.multiline ? multilineRows : undefined}
          value={opts.value}
          onChange={(e) => opts.onChange(e.target.value)}
          placeholder={opts.placeholder}
          className={cls.textField[platform]}
          sx={fieldSx(opts.multiline)}
        />
      </Box>
    );
  };

  const steps = [t('addressText'), t('shipping'), t('payment'), t('review')];

  // Navigate to a step. Advancing past Address (step 0) requires the required
  // address fields; if incomplete, flag the empty fields instead of moving.
  const goToStep = (target: number) => {
    if (target > 0 && isFormIncomplete) {
      setAttemptedNext(true);
      setSnackbarMsg('fillRequiredFields');
      setSnackbarOpen(true);
      return;
    }
    setCurrentStep(target);
  };

  // Shared card views (reused by their own step and the Review recap)
  const addressSummaryCard = (onEdit: () => void) => (
    <Box className={cls.addressCard}>
      <Box className="min-w-0">
        <Typography className={`${fc} ${cls.addressName}`}>
          {fullName}
          {phoneNumber ? ` · ${phoneNumber}` : ''}
        </Typography>
        <Typography className={`${fc} ${cls.addressLine}`}>
          {address}
        </Typography>
      </Box>
      <IconButton
        onClick={onEdit}
        sx={{ color: navy, p: 0.5 }}
        aria-label={t('addressText')}
      >
        <Pencil size={18} />
      </IconButton>
    </Box>
  );

  const deliveryCard = (
    <Box className={cls.infoCard}>
      <Box className={cls.infoIconTile}>
        <Truck size={20} />
      </Box>
      <Box className={cls.infoGrow}>
        <Typography className={`${fc} ${cls.infoTitle}`}>
          {t('standardDelivery')}
        </Typography>
        <Typography className={`${fc} ${cls.infoSub}`}>
          {t('nationwideDelivery')}
        </Typography>
      </Box>
      <Typography className={`${fc} ${cls.infoRight}`}>{t('free')}</Typography>
    </Box>
  );

  const paymentCard = (
    <Box className={cls.infoCard}>
      <Box className={cls.infoIconTile}>
        <Banknote size={20} />
      </Box>
      <Box className={cls.infoGrow}>
        <Typography className={`${fc} ${cls.infoTitle}`}>
          {t('cashOnDelivery')}
        </Typography>
        <Typography className={`${fc} ${cls.infoSub}`}>
          {t('payInCash')} — {totalPrice.toFixed(2)} {t('manat')}
        </Typography>
      </Box>
    </Box>
  );

  return (
    <Layout
      handleHeaderBackButton={() =>
        platform === 'mobile' && currentStep > 0
          ? setCurrentStep(currentStep - 1)
          : router.push('/cart')
      }
    >
      <Box className={checkoutDialogClasses.dialogContent[platform]}>
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

        {/* Mobile: stepped checkout wizard */}
        {platform === 'mobile' ? (
          <Box className={cls.mobileWrap}>
            {/* Stepper (clickable) */}
            <Box className={cls.stepper}>
              <Box className={cls.stepDotsRow}>
                {steps.map((label, i) => (
                  <Fragment key={label}>
                    <Box
                      component="button"
                      onClick={() => goToStep(i)}
                      className={
                        i <= currentStep
                          ? cls.stepDotActive
                          : cls.stepDotInactive
                      }
                    >
                      {i + 1}
                    </Box>
                    {i < steps.length - 1 && <Box className={cls.stepLine} />}
                  </Fragment>
                ))}
              </Box>
              <Box className={cls.stepLabelsRow}>
                {steps.map((label, i) => (
                  <Typography
                    key={label}
                    onClick={() => goToStep(i)}
                    className={`${fc} ${
                      i === currentStep
                        ? cls.stepLabelActive
                        : cls.stepLabelInactive
                    }`}
                  >
                    {label}
                  </Typography>
                ))}
              </Box>
            </Box>

            {/* Step 0 — Address */}
            {currentStep === 0 && (
              <Box className={cls.section}>
                <Typography className={`${fc} ${cls.sectionTitle.mobile}`}>
                  {t('deliveryAddress')}
                </Typography>
                {!editingAddress ? (
                  addressSummaryCard(() => setEditingAddress(true))
                ) : (
                  <Box className={cls.editCard}>
                    {renderField({
                      label: t('fullName'),
                      value: fullName,
                      onChange: setFullName,
                      placeholder: t('fullNamePlaceholder'),
                      required: true,
                      error: attemptedNext && !fullName.trim(),
                    })}
                    {renderField({
                      label: t('phoneNumber'),
                      value: phoneNumber,
                      onChange: setPhoneNumber,
                      placeholder: t('phoneNumberPlaceholder'),
                      required: true,
                      error: attemptedNext && !phoneNumber.trim(),
                    })}
                    {renderField({
                      label: t('addressText'),
                      value: address,
                      onChange: setAddress,
                      placeholder: t('addressPlaceholder'),
                      required: true,
                      error: attemptedNext && !address.trim(),
                    })}
                    {user && (
                      <FormControlLabel
                        className={cls.saveRow}
                        control={
                          <Checkbox
                            checked={saveToProfile}
                            onChange={(e) => setSaveToProfile(e.target.checked)}
                            sx={{
                              color: muted,
                              '&.Mui-checked': { color: navy },
                            }}
                          />
                        }
                        label={
                          <span className={`${fc} ${cls.saveLabel}`}>
                            {t('saveToProfile')}
                          </span>
                        }
                      />
                    )}
                  </Box>
                )}
              </Box>
            )}

            {/* Step 1 — Delivery */}
            {currentStep === 1 && (
              <Box className={cls.section}>
                <Typography className={`${fc} ${cls.sectionTitle.mobile}`}>
                  {t('delivery')}
                </Typography>
                {deliveryCard}
              </Box>
            )}

            {/* Step 2 — Payment */}
            {currentStep === 2 && (
              <Box className={cls.section}>
                <Typography className={`${fc} ${cls.sectionTitle.mobile}`}>
                  {t('payment')}
                </Typography>
                {paymentCard}
              </Box>
            )}

            {/* Step 3 — Review */}
            {currentStep === 3 && (
              <>
                <Box className={cls.section}>
                  <Typography className={`${fc} ${cls.sectionTitle.mobile}`}>
                    {t('deliveryAddress')}
                  </Typography>
                  {addressSummaryCard(() => {
                    setEditingAddress(true);
                    setCurrentStep(0);
                  })}
                </Box>
                <Box className={cls.section}>
                  <Typography className={`${fc} ${cls.sectionTitle.mobile}`}>
                    {t('delivery')}
                  </Typography>
                  {deliveryCard}
                </Box>
                <Box className={cls.section}>
                  <Typography className={`${fc} ${cls.sectionTitle.mobile}`}>
                    {t('payment')}
                  </Typography>
                  {paymentCard}
                </Box>
                <Box className={cls.section}>
                  <Typography className={`${fc} ${cls.sectionTitle.mobile}`}>
                    {t('orderNotes')}
                  </Typography>
                  <TextField
                    fullWidth
                    multiline
                    rows={4}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder={t('orderNotesPlaceholder')}
                    className={cls.textField.mobile}
                    sx={fieldSx(true)}
                  />
                </Box>
              </>
            )}

            {/* Total payable + step navigation */}
            <Box className={cls.totalContainer.mobile}>
              <Box className={cls.totalRow.mobile}>
                <Typography className={`${fc} ${cls.totalLabel.mobile}`}>
                  {t('totalPayable')}
                </Typography>
                <Typography className={`${fc} ${cls.totalValue.mobile}`}>
                  {totalPrice.toFixed(2)} {t('manat')}
                </Typography>
              </Box>
              <Box className={cls.navRow}>
                {currentStep > 0 && (
                  <Button
                    onClick={() => setCurrentStep(currentStep - 1)}
                    className={`${fc} ${cls.navBackBtn}`}
                    sx={{
                      color: navy,
                      backgroundColor: 'white',
                      '&:hover': { backgroundColor: '#F5F5F8' },
                    }}
                  >
                    {t('back')}
                  </Button>
                )}
                {currentStep < steps.length - 1 ? (
                  <Button
                    onClick={() => goToStep(currentStep + 1)}
                    className={`${fc} ${cls.navPrimaryBtn}`}
                    sx={{
                      backgroundColor: navy,
                      color: 'white',
                      '&:hover': { backgroundColor: colors.buttonHoverBg },
                    }}
                  >
                    {t('next')}
                  </Button>
                ) : (
                  <Button
                    onClick={handleOrder}
                    disabled={loading || isFormIncomplete}
                    className={`${fc} ${cls.navPrimaryBtn}`}
                    sx={{
                      backgroundColor: red,
                      color: 'white',
                      '&:hover': { backgroundColor: '#C6101C' },
                      '&:disabled': {
                        backgroundColor: '#E4E3EB',
                        color: '#fff',
                      },
                    }}
                  >
                    {loading ? (
                      <CircularProgress size={22} color="inherit" />
                    ) : (
                      t('placeOrder')
                    )}
                  </Button>
                )}
              </Box>
            </Box>
          </Box>
        ) : (
          <Box className={cls.formContainer.web}>
            {/* Customer Details */}
            <Box className={cls.customerDetails.web}>
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
        )}
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
          severity={snackbarMsg === 'serverError' ? 'error' : 'warning'}
          variant="filled"
          className="w-100%"
        >
          {t(snackbarMsg)}
        </Alert>
      </Snackbar>
    </Layout>
  );
}
