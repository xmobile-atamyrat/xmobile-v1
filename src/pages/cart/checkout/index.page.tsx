import OutOfStockDialog from '@/pages/cart/components/OutOfStockDialog';
import Layout from '@/pages/components/Layout';
import VariantBadge from '@/pages/components/VariantBadge';
import { fetchColors } from '@/pages/lib/apis';
import { OUT_OF_STOCK_ERROR } from '@/pages/lib/constants';
import { fetchWithoutCreds, useFetchWithCreds } from '@/pages/lib/fetch';
import {
  getProductMediaUrl,
  PRODUCT_IMAGE_FALLBACK,
  tierForProductList,
} from '@/pages/lib/mediaUrls';
import { useNetworkContext } from '@/pages/lib/NetworkContext';
import { usePlatform } from '@/pages/lib/PlatformContext';
import { useUserContext } from '@/pages/lib/UserContext';
import { parseName } from '@/pages/lib/utils';
import { cartIndexClasses } from '@/styles/classMaps/cart/index';
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
  CardMedia,
  Checkbox,
  CircularProgress,
  FormControlLabel,
  IconButton,
  Link,
  Snackbar,
  TextField,
  Typography,
} from '@mui/material';
import { CartItem, Color, Prices, Product } from '@prisma/client';
import { Banknote, Check, MapPin, Pencil, Truck } from 'lucide-react';
import { GetStaticProps } from 'next';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/router';
import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';

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
  const { network } = useNetworkContext();

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
    (CartItem & { product: Product })[] | null
  > => {
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
        // Out-of-stock items can't be ordered, so they don't count toward the total
        const sum = cartItems.reduce(
          (acc, item) =>
            item.product.isOutOfStock
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

  const outOfStockItems = cartItems.filter((item) => item.product.isOutOfStock);

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
      } else if (message === OUT_OF_STOCK_ERROR) {
        // A product went out of stock after this page loaded, so local state
        // can't name the offender — refetch before opening the dialog
        const fresh = await loadCartItems();
        if (fresh?.some((item) => item.product.isOutOfStock)) {
          setShowOutOfStockDialog(true);
        } else {
          setSnackbarOpen(true);
        }
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

  // 52px order-summary thumbnails (web) — same tiered media path the cards use
  const summaryThumbSrc = (raw: string | undefined) => {
    if (raw == null) return undefined;
    if (raw.startsWith('http')) return raw;
    return (
      getProductMediaUrl(tierForProductList(network), raw) ??
      PRODUCT_IMAGE_FALLBACK
    );
  };

  // Shared field style — hairline border, navy focus, ink text (design tokens).
  // Web uses the mockup's compact 48px/15px field (spec 1621) rather than the
  // 60px/18px `units` default other web forms share.
  const isWeb = platform === 'web';
  const fieldHeight = isWeb ? '48px' : units.inputHeight.mobile;
  const fieldFontSize = isWeb ? '15px' : units.inputFontSize.mobile;
  const fieldSx = (multiline = false) => ({
    '& .MuiOutlinedInput-root': {
      backgroundColor: 'white',
      borderRadius: '12px',
      ...(multiline ? {} : { height: fieldHeight }),
      fontSize: fieldFontSize,
      '& fieldset': {
        borderColor: hairline,
        borderWidth: isWeb ? '1px' : '1.5px',
      },
      '&:hover fieldset': { borderColor: muted },
      '&.Mui-focused fieldset': {
        borderColor: navy,
        borderWidth: isWeb ? '2px' : '1.5px',
      },
      '&.Mui-error fieldset': { borderColor: red, borderWidth: '1.5px' },
    },
    '& .MuiInputBase-input': {
      paddingX: isWeb ? '14px' : '16px',
      paddingY: isWeb && !multiline ? 0 : '16px',
      fontSize: fieldFontSize,
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
  }) => (
    // mobile-only: the web tree has its own renderWebField below
    <Box className={cls.fieldContainer.mobile}>
      <Typography className={`${fc} ${cls.label.mobile}`}>
        {opts.label}
        {opts.required && <span className={cls.required.mobile}> *</span>}
      </Typography>
      <TextField
        fullWidth
        required={opts.required}
        error={opts.error}
        multiline={opts.multiline}
        rows={opts.multiline ? 4 : undefined}
        value={opts.value}
        onChange={(e) => opts.onChange(e.target.value)}
        placeholder={opts.placeholder}
        className={cls.textField.mobile}
        sx={fieldSx(opts.multiline)}
      />
    </Box>
  );

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

  // Snackbar is shared by both platform trees
  const errorSnackbar = (
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
  );

  // Web labelled field — 12px muted label over the compact 48px input
  const renderWebField = (opts: {
    label: string;
    value: string;
    onChange: (v: string) => void;
    placeholder: string;
    required?: boolean;
    multiline?: boolean;
    wide?: boolean;
  }) => (
    <Box className={opts.wide ? cls.web.fieldWide : undefined}>
      <Typography className={`${fc} ${cls.web.fieldLabel}`}>
        {opts.label}
        {opts.required && <span className={cls.required.web}> *</span>}
      </Typography>
      <TextField
        fullWidth
        required={opts.required}
        multiline={opts.multiline}
        rows={opts.multiline ? 4 : undefined}
        value={opts.value}
        onChange={(e) => opts.onChange(e.target.value)}
        placeholder={opts.placeholder}
        className={cls.textField.web}
        sx={fieldSx(opts.multiline)}
      />
    </Box>
  );

  // Desktop checkout (spec 1608-1683): address / delivery / payment cards on
  // the left, a 400px "Your order" card on the right. Single page — the mobile
  // wizard's step state is not used here.
  if (platform === 'web') {
    const webSteps = [
      { label: t('cart'), state: 'done' as const, href: '/cart' },
      { label: t('checkout'), state: 'active' as const },
      { label: t('confirmation'), state: 'idle' as const },
    ];

    return (
      <Layout handleHeaderBackButton={() => router.push('/cart')}>
        <Box className={cls.web.page}>
          <Breadcrumbs separator="|" className={cls.breadcrumbs.web}>
            <Link href="/" className="no-underline">
              <Typography
                className={`${fc} ${cartIndexClasses.breadcrumbsText} font-regular`}
              >
                {t('home')}
              </Typography>
            </Link>
            <Link href="/cart" className="no-underline">
              <Typography
                className={`${fc} ${cartIndexClasses.breadcrumbsText} font-regular`}
              >
                {t('cart')}
              </Typography>
            </Link>
            <Typography
              className={`${fc} ${cartIndexClasses.breadcrumbsText} font-bold`}
            >
              {t('checkout')}
            </Typography>
          </Breadcrumbs>

          <Box className={cls.web.headRow}>
            <Typography className={`${fc} ${cls.web.title}`}>
              {t('checkout')}
            </Typography>
          </Box>

          {/* 3-step progress — real state only, no fabricated stages */}
          <Box className={cls.web.stepper}>
            {webSteps.map((step, i) => (
              <Fragment key={step.label}>
                <Box className={cls.web.stepItem}>
                  <Box
                    className={
                      {
                        done: cls.web.stepDotDone,
                        active: cls.web.stepDotActive,
                        idle: cls.web.stepDotIdle,
                      }[step.state]
                    }
                  >
                    {step.state === 'done' ? <Check size={16} /> : i + 1}
                  </Box>
                  <Typography
                    onClick={
                      step.href ? () => router.push(step.href) : undefined
                    }
                    className={`${fc} ${
                      // eslint-disable-next-line no-nested-ternary
                      step.href
                        ? cls.web.stepLabelLink
                        : step.state === 'idle'
                          ? cls.web.stepLabelIdle
                          : cls.web.stepLabel
                    }`}
                  >
                    {step.label}
                  </Typography>
                </Box>
                {i < webSteps.length - 1 && (
                  <Box
                    className={
                      webSteps[i + 1].state === 'idle'
                        ? cls.web.stepLineIdle
                        : cls.web.stepLineDone
                    }
                  />
                )}
              </Fragment>
            ))}
          </Box>

          <Box className={cls.web.grid}>
            <Box className={cls.web.formCol}>
              {/* Delivery address (spec 1620) */}
              <Box className={cls.web.card}>
                <Box className={cls.web.cardHead}>
                  <MapPin className={cls.web.cardIcon} />
                  <Typography className={`${fc} ${cls.web.cardTitle}`}>
                    {t('deliveryAddress')}
                  </Typography>
                </Box>
                <Box className={cls.web.fieldGrid}>
                  {renderWebField({
                    label: t('fullName'),
                    value: fullName,
                    onChange: setFullName,
                    placeholder: t('fullNamePlaceholder'),
                    required: true,
                  })}
                  {renderWebField({
                    label: t('phoneNumber'),
                    value: phoneNumber,
                    onChange: setPhoneNumber,
                    placeholder: t('phoneNumberPlaceholder'),
                    required: true,
                  })}
                  {renderWebField({
                    label: t('addressText'),
                    value: address,
                    onChange: setAddress,
                    placeholder: t('addressPlaceholder'),
                    required: true,
                    wide: true,
                  })}
                  {renderWebField({
                    label: t('orderNotes'),
                    value: notes,
                    onChange: setNotes,
                    placeholder: t('orderNotesPlaceholder'),
                    multiline: true,
                    wide: true,
                  })}
                </Box>
                {user && (
                  <FormControlLabel
                    className={cls.web.saveRow}
                    control={
                      <Checkbox
                        checked={saveToProfile}
                        onChange={(e) => setSaveToProfile(e.target.checked)}
                        sx={{ color: muted, '&.Mui-checked': { color: navy } }}
                      />
                    }
                    label={
                      <span className={`${fc} ${cls.web.saveLabel}`}>
                        {t('saveToProfile')}
                      </span>
                    }
                  />
                )}
              </Box>

              {/* Delivery method (spec 1635) — one real option */}
              <Box className={cls.web.card}>
                <Box className={cls.web.cardHead}>
                  <Truck className={cls.web.cardIcon} />
                  <Typography className={`${fc} ${cls.web.cardTitle}`}>
                    {t('delivery')}
                  </Typography>
                </Box>
                <Box className={cls.web.optionRow}>
                  <Box className={cls.web.radioOuter}>
                    <Box className={cls.web.radioInner} />
                  </Box>
                  <Box className={cls.web.optionBody}>
                    <Typography className={`${fc} ${cls.web.optionTitle}`}>
                      {t('standardDelivery')}
                    </Typography>
                    <Typography className={`${fc} ${cls.web.optionSub}`}>
                      {t('nationwideDelivery')}
                    </Typography>
                  </Box>
                  <Typography className={`${fc} ${cls.web.optionRight}`}>
                    {t('free')}
                  </Typography>
                </Box>
              </Box>

              {/* Payment (spec 1648) — COD is the only method */}
              <Box className={cls.web.card}>
                <Box className={cls.web.cardHead}>
                  <Banknote className={cls.web.cardIcon} />
                  <Typography className={`${fc} ${cls.web.cardTitle}`}>
                    {t('payment')}
                  </Typography>
                </Box>
                <Box className={cls.web.optionRow}>
                  <Box className={cls.web.radioOuter}>
                    <Box className={cls.web.radioInner} />
                  </Box>
                  <Box className={cls.web.optionBody}>
                    <Typography className={`${fc} ${cls.web.optionTitle}`}>
                      {t('cashOnDelivery')}
                    </Typography>
                    <Typography className={`${fc} ${cls.web.optionSub}`}>
                      {t('payInCash')}
                    </Typography>
                  </Box>
                </Box>
              </Box>
            </Box>

            {/* Your order (spec 1662) */}
            <Box className={cls.web.summaryCard}>
              <Typography className={`${fc} ${cls.web.summaryTitle}`}>
                {t('yourOrder')}
              </Typography>
              <Box className={cls.web.summaryItems}>
                {cartItems.map((item) => {
                  const thumb = summaryThumbSrc(item.product.imgUrls[0]);
                  return (
                    <Box key={item.id} className={cls.web.summaryItem}>
                      <Box className={cls.web.summaryThumb}>
                        {thumb && (
                          <CardMedia
                            component="img"
                            image={thumb}
                            alt={parseName(
                              item.product.name,
                              router.locale ?? 'tk',
                            )}
                            className={cls.web.summaryThumbImg}
                            loading="lazy"
                            decoding="async"
                            onError={(e) => {
                              const el = e.currentTarget;
                              el.onerror = null;
                              el.src = PRODUCT_IMAGE_FALLBACK;
                            }}
                          />
                        )}
                      </Box>
                      <Box className={cls.web.summaryItemBody}>
                        <Typography
                          className={`${fc} ${cls.web.summaryItemName}`}
                        >
                          {parseName(item.product.name, router.locale ?? 'tk')}
                        </Typography>
                        {item.selectedVariant && (
                          <VariantBadge
                            {...resolveVariantDisplay(
                              item.selectedVariant,
                              colorsMap,
                            )}
                          />
                        )}
                        <Typography
                          className={`${fc} ${cls.web.summaryItemQty}`}
                        >
                          × {item.quantity}
                        </Typography>
                      </Box>
                      <Typography
                        className={`${fc} ${cls.web.summaryItemPrice}`}
                      >
                        {(getItemPrice(item) * item.quantity).toFixed(2)}
                      </Typography>
                    </Box>
                  );
                })}
              </Box>
              <Box className={cls.web.totals}>
                <Box className={cls.web.totalsRow}>
                  <Typography className={`${fc} ${cls.web.totalsLabel}`}>
                    {t('subtotal')}
                  </Typography>
                  <Typography className={`${fc} ${cls.web.totalsValue}`}>
                    {totalPrice.toFixed(2)} {t('manat')}
                  </Typography>
                </Box>
                <Box className={cls.web.totalsRow}>
                  <Typography className={`${fc} ${cls.web.totalsLabel}`}>
                    {t('delivery')}
                  </Typography>
                  <Typography className={`${fc} ${cls.web.totalsFree}`}>
                    {t('free')}
                  </Typography>
                </Box>
              </Box>
              <Box className={cls.web.grandRow}>
                <Typography className={`${fc} ${cls.web.grandLabel}`}>
                  {t('total')}
                </Typography>
                <Typography className={`${fc} ${cls.web.grandValue}`}>
                  {totalPrice.toFixed(2)} {t('manat')}
                </Typography>
              </Box>
              <Button
                onClick={handleOrder}
                disabled={loading || isFormIncomplete || cartItems.length === 0}
                className={`${fc} ${cls.web.placeOrderBtn}`}
                sx={{
                  backgroundColor: red,
                  color: 'white',
                  '&:hover': { backgroundColor: '#C6101C' },
                  '&:disabled': { backgroundColor: '#E4E3EB', color: '#fff' },
                }}
              >
                {loading ? (
                  <CircularProgress size={24} color="inherit" />
                ) : (
                  `${t('placeOrder')} · ${totalPrice.toFixed(2)} ${t('manat')}`
                )}
              </Button>
            </Box>
          </Box>
        </Box>
        {errorSnackbar}
      </Layout>
    );
  }

  return (
    <Layout
      handleHeaderBackButton={() =>
        currentStep > 0 ? setCurrentStep(currentStep - 1) : router.push('/cart')
      }
    >
      <Box className={checkoutDialogClasses.dialogContent[platform]}>
        {/* Mobile: stepped checkout wizard */}
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
                      i <= currentStep ? cls.stepDotActive : cls.stepDotInactive
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
      </Box>

      {errorSnackbar}

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
