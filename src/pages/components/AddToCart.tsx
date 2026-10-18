import { useCartContext } from '@/pages/lib/CartContext';
import { AddToCartProps, SnackbarProps } from '@/pages/lib/types';
import { useUserContext } from '@/pages/lib/UserContext';
import { Box, IconButton, Input, Snackbar, Typography } from '@mui/material';
import {
  AlertTriangle,
  CheckCircle2,
  Info,
  Minus,
  Plus,
  ShoppingCart,
  Trash2,
  XCircle,
} from 'lucide-react';
import { useRouter } from 'next/router';
import { useTranslations } from 'next-intl';
import { Suspense, useCallback, useEffect, useRef, useState } from 'react';

import { fetchWithoutCreds, useFetchWithCreds } from '@/pages/lib/fetch';
import {
  MAX_CART_QUANTITY,
  mobileBottomNavHeight,
} from '@/pages/lib/constants';
import { usePlatform } from '@/pages/lib/PlatformContext';
import { debounce } from '@/pages/product/utils';
import { addToCartClasses } from '@/styles/classMaps/components/addToCart';
import { snackbarClasses } from '@/styles/classMaps/components/snackbar';
import { fontClassName } from '@/styles/theme';
import CircularProgress from '@mui/material/CircularProgress';

// The quantity field is free text, so it can briefly be empty while the user
// retypes it. An empty field reads as 0, which is shown blank and never sent to
// the API. Anything but digits returns null so the keystroke is ignored rather
// than read as a different number ('1.5' must not become 15).
function parseQuantityInput(value: string): number | null {
  if (value === '') return 0;
  if (!/^\d+$/.test(value)) return null;
  return Math.min(parseInt(value, 10), MAX_CART_QUANTITY);
}

const snackbarIcon = {
  success: CheckCircle2,
  error: XCircle,
  warning: AlertTriangle,
  info: Info,
};

export default function AddToCart({
  productId,
  quantity: initialQuantity = 1,
  cartAction,
  cartItemId = undefined,
  price,
  selectedVariant,
  variantLabel,
  onDelete,
  setTotalPrice,
}: AddToCartProps) {
  const [quantity, setQuantity] = useState(initialQuantity);
  // The last quantity >= 1, which a cleared field falls back to on blur.
  const lastValidQuantity = useRef(Math.max(1, initialQuantity));
  useEffect(() => {
    if (quantity >= 1) lastValidQuantity.current = quantity;
  }, [quantity]);
  const { user, accessToken } = useUserContext();
  const { setCartCount } = useCartContext();
  const [snackbarMessage, setSnackbarMessage] = useState<SnackbarProps>();
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const t = useTranslations();
  const fetchWithCreds = useFetchWithCreds();
  const platform = usePlatform();
  const router = useRouter();

  const addCartItems = async () => {
    if (price.includes('null')) {
      setSnackbarOpen(true);
      setSnackbarMessage({
        message: 'nullPriceCart',
        severity: 'warning',
      });
      return;
    }
    // A cleared field is restored on blur, but the click may still race it.
    const addQuantity = quantity >= 1 ? quantity : lastValidQuantity.current;
    try {
      const data = user
        ? await fetchWithCreds({
            accessToken,
            path: '/api/cart',
            method: 'POST',
            body: {
              userId: user.id,
              productId,
              quantity: addQuantity,
              selectedVariant,
            },
          })
        : await fetchWithoutCreds('/api/guest/cart', 'POST', {
            productId,
            quantity: addQuantity,
            selectedVariant,
          });

      if (data.success) {
        setCartCount((count) => count + 1);
        setSnackbarOpen(true);
        setSnackbarMessage({
          message: 'addToCartSuccess',
          severity: 'success',
          variantLabel,
        });
      } else {
        setSnackbarOpen(true);
        setSnackbarMessage({
          message: data.message,
          severity: data.message === 'cartItemExistError' ? 'warning' : 'error',
        });
      }
    } catch (error) {
      console.error(t('addToCartFail'));
    }
  };

  const deleteCartItems = async (cartId: string) => {
    try {
      const data = user
        ? await fetchWithCreds({
            accessToken,
            path: '/api/cart',
            method: 'DELETE',
            body: {
              id: cartId,
            },
          })
        : await fetchWithoutCreds('/api/guest/cart', 'DELETE', {
            id: cartId,
          });

      if (data.success) {
        setSnackbarOpen(true);
        setSnackbarMessage({
          message: 'deleteFromCartSuccess',
          severity: 'success',
        });
      } else {
        setSnackbarOpen(true);
        setSnackbarMessage({
          message: 'deleteFromCartFail',
          severity: 'error',
        });
      }
    } catch (error) {
      console.error(error);
    }
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const editCartItems = useCallback(
    debounce(async (itemQuantity: number) => {
      try {
        const data = user
          ? await fetchWithCreds({
              accessToken,
              path: '/api/cart',
              method: 'PUT',
              body: {
                id: cartItemId,
                quantity: itemQuantity,
              },
            })
          : await fetchWithoutCreds('/api/guest/cart', 'PUT', {
              id: cartItemId,
              quantity: itemQuantity,
            });

        if (data.success) {
          setSnackbarOpen(true);
          setSnackbarMessage({
            message: 'editCartQuantitySuccess',
            severity: 'success',
          });
        } else {
          setSnackbarOpen(true);
          setSnackbarMessage({
            message: 'editCartQuantityFail',
            severity: 'error',
          });
        }
      } catch (error) {
        console.error('Error: ', error);
      }
    }, 300),
    // todo: eslint says there should be dependency, not so sure about passing debounce
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [debounce],
  );

  const handleProductQuantity =
    (action: 'add' | 'remove' | 'quantityAdd' | 'quantityRemove') => () => {
      if (
        (action === 'add' || action === 'quantityAdd') &&
        quantity >= MAX_CART_QUANTITY
      ) {
        return;
      }
      if (action === 'add') {
        setQuantity(quantity + 1);
        if (setTotalPrice) setTotalPrice((cur) => cur + Number(price));
        editCartItems(quantity + 1);
      } else if (action === 'remove') {
        if (quantity > 1) {
          setQuantity(quantity - 1);
          if (setTotalPrice) setTotalPrice((cur) => cur - Number(price));
          editCartItems(quantity - 1);
        }
      } else if (action === 'quantityAdd') {
        setQuantity(quantity + 1);
        if (setTotalPrice) setTotalPrice((cur) => cur + Number(price));
      } else if (action === 'quantityRemove' && quantity > 1) {
        setQuantity(quantity - 1);
        if (setTotalPrice) setTotalPrice((cur) => cur - Number(price));
      }
    };

  const handleQuantityChange =
    (syncToCart: boolean) => (e: { target: { value: string } }) => {
      const newQuantity = parseQuantityInput(e.target.value);
      if (newQuantity === null) return;
      setQuantity(newQuantity);
      if (setTotalPrice)
        setTotalPrice(
          (cur) => cur - quantity * Number(price) + newQuantity * Number(price),
        );
      if (syncToCart && newQuantity >= 1) editCartItems(newQuantity);
    };

  // Leaving the field blank restores the quantity it had before it was
  // cleared. The 0 was never sent, so the cart already holds that value.
  const handleQuantityBlur = () => {
    if (quantity >= 1) return;
    const restored = lastValidQuantity.current;
    setQuantity(restored);
    if (setTotalPrice)
      setTotalPrice((cur) => cur + (restored - quantity) * Number(price));
  };

  return (
    <Box className={addToCartClasses.main[platform]}>
      <Suspense fallback={<CircularProgress />}>
        {/* cartButton */}
        {cartAction === 'add' && (
          <IconButton
            disableRipple
            type="submit"
            onClick={addCartItems}
            // the web variant is icon-only, so the label has to live here
            aria-label={t('addToCart')}
            title={t('addToCart')}
            className={addToCartClasses.cartButton.button[platform]}
          >
            <ShoppingCart
              className={addToCartClasses.cartButton.icon[platform]}
            />
            <Typography
              className={`${fontClassName.className} ${addToCartClasses.cartButton.text[platform]}`}
            >
              {t('addToCart')}
            </Typography>
          </IconButton>
        )}

        {cartAction === 'delete' && (
          <Box className={addToCartClasses.circIcon.box[platform]}>
            {/* line total — first in the DOM for the web column's price/stepper/
                remove order; hidden on mobile, so the row there is unchanged */}
            <Box className={addToCartClasses.price[platform]}>
              <Typography
                className={`${fontClassName.className} ${addToCartClasses.priceText[platform]}`}
              >
                {quantity * Number(price)} TMT
              </Typography>
              {quantity > 1 && !Number.isNaN(Number(price)) && (
                <Typography
                  className={`${fontClassName.className} ${addToCartClasses.unitText[platform]}`}
                >
                  {quantity} × {Number(price)} TMT
                </Typography>
              )}
            </Box>

            <Box className={addToCartClasses.quanChange[platform]}>
              {/* removeButton */}
              <IconButton
                disableRipple
                className={addToCartClasses.stepperButton[platform]}
                onClick={handleProductQuantity('remove')}
              >
                <Minus className={addToCartClasses.circIcon.minus[platform]} />
              </IconButton>
              {/* quantityInput */}
              <Input
                name="quantity"
                inputProps={{ min: 1, max: MAX_CART_QUANTITY }}
                className={`${addToCartClasses.inputDet[platform]} ${fontClassName.className}`}
                value={quantity || ''}
                disableUnderline
                onChange={handleQuantityChange(true)}
                onBlur={handleQuantityBlur}
              />

              {/* addButton */}
              <IconButton
                disableRipple
                className={addToCartClasses.stepperButton[platform]}
                onClick={handleProductQuantity('add')}
              >
                <Plus className={addToCartClasses.circIcon.plus[platform]} />
              </IconButton>
            </Box>

            {/* delete button */}
            <Box className={addToCartClasses.deleteButton.box[platform]}>
              <IconButton
                disableRipple
                className={addToCartClasses.deleteButton.iconButton[platform]}
                type="submit"
                onClick={() => {
                  onDelete(cartItemId);
                  if (setTotalPrice)
                    setTotalPrice((cur) => cur - quantity * Number(price));
                  deleteCartItems(cartItemId);
                }}
              >
                <Trash2
                  className={addToCartClasses.deleteButton.deleteIcon[platform]}
                />
                {/* web spells the action out (spec 1589); mobile stays icon-only */}
                <Typography
                  className={`${fontClassName.className} ${addToCartClasses.deleteButton.label[platform]}`}
                >
                  {t('remove')}
                </Typography>
              </IconButton>
            </Box>
          </Box>
        )}

        {cartAction === 'detail' && (
          <Box className={addToCartClasses.detail.box[platform]}>
            <Box
              className={addToCartClasses.detail.bg[platform]}
              sx={
                platform === 'mobile'
                  ? { paddingBottom: `${mobileBottomNavHeight}px` }
                  : undefined
              }
            >
              <Box className={addToCartClasses.detail.stepper[platform]}>
                {/* removeButton */}
                <IconButton
                  onClick={handleProductQuantity('quantityRemove')}
                  className={addToCartClasses.iconButton[platform]}
                >
                  <Minus className={addToCartClasses.detail.quantityMinus} />
                </IconButton>

                {/* quantityInput */}
                <Input
                  name="quantity"
                  inputProps={{ min: 1, max: MAX_CART_QUANTITY }}
                  className={`${addToCartClasses.input[platform]} ${fontClassName.className}`}
                  value={quantity || ''}
                  disableUnderline
                  // the product page renders this control without a running
                  // total; only the cart page passes setTotalPrice
                  onChange={handleQuantityChange(false)}
                  onBlur={handleQuantityBlur}
                />

                {/* addButton */}
                <IconButton
                  onClick={handleProductQuantity('quantityAdd')}
                  className={addToCartClasses.iconButton[platform]}
                >
                  <Plus className={addToCartClasses.detail.quantityPlus} />
                </IconButton>
              </Box>

              {/* addCart */}
              <IconButton
                className={addToCartClasses.detail.addToCart[platform]}
                onClick={addCartItems}
                disableRipple
              >
                <ShoppingCart
                  className={addToCartClasses.detail.cartIcon[platform]}
                />
                <Typography
                  className={`${fontClassName.className} ${addToCartClasses.detail.addToCartText[platform]}`}
                >
                  {t('addToCart')}
                </Typography>
              </IconButton>
            </Box>
          </Box>
        )}
      </Suspense>

      {/* snackbarPop-ups */}
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
        sx={
          platform === 'mobile'
            ? { bottom: `${mobileBottomNavHeight + 8}px !important` }
            : undefined
        }
      >
        <Box className={snackbarClasses.pill}>
          {snackbarMessage?.severity &&
            (() => {
              const Icon = snackbarIcon[snackbarMessage.severity];
              return (
                <Icon
                  size={20}
                  className={snackbarClasses.icon[snackbarMessage.severity]}
                />
              );
            })()}
          <Typography
            className={`${fontClassName.className} ${snackbarClasses.message}`}
          >
            {snackbarMessage?.message && t(snackbarMessage.message)}
            {snackbarMessage?.variantLabel &&
              ` · ${snackbarMessage.variantLabel}`}
          </Typography>
          {snackbarMessage?.message === 'addToCartSuccess' && (
            <span
              className={`${fontClassName.className} ${snackbarClasses.viewLink}`}
              onClick={() => {
                setSnackbarOpen(false);
                router.push('/cart');
              }}
            >
              {t('view')}
            </span>
          )}
        </Box>
      </Snackbar>
    </Box>
  );
}
