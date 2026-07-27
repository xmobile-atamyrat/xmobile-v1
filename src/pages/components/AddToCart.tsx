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
import { Suspense, useCallback, useState } from 'react';

import { fetchWithoutCreds, useFetchWithCreds } from '@/pages/lib/fetch';
import { mobileBottomNavHeight } from '@/pages/lib/constants';
import { usePlatform } from '@/pages/lib/PlatformContext';
import { debounce } from '@/pages/product/utils';
import { addToCartClasses } from '@/styles/classMaps/components/addToCart';
import { snackbarClasses } from '@/styles/classMaps/components/snackbar';
import { fontClassName } from '@/styles/theme';
import CircularProgress from '@mui/material/CircularProgress';

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
  const { user, accessToken } = useUserContext();
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
    try {
      const data = user
        ? await fetchWithCreds({
            accessToken,
            path: '/api/cart',
            method: 'POST',
            body: {
              userId: user.id,
              productId,
              quantity,
              selectedVariant,
            },
          })
        : await fetchWithoutCreds('/api/guest/cart', 'POST', {
            productId,
            quantity,
            selectedVariant,
          });

      if (data.success) {
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

  return (
    <Box className={addToCartClasses.main[platform]}>
      <Suspense fallback={<CircularProgress />}>
        {/* cartButton */}
        {cartAction === 'add' && (
          <IconButton
            disableRipple
            type="submit"
            onClick={addCartItems}
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
            <Box className={addToCartClasses.quanChange[platform]}>
              {/* removeButton */}
              <IconButton
                disableRipple
                onClick={handleProductQuantity('remove')}
              >
                <Minus className={addToCartClasses.circIcon.fSize[platform]} />
              </IconButton>
              {/* quantityInput */}
              <Input
                name="quantity"
                inputProps={{ min: 1 }}
                className={`${addToCartClasses.inputDet[platform]} ${fontClassName.className}`}
                value={quantity}
                disableUnderline
                onChange={(e) => {
                  const newQuantity = Number(e.target.value);
                  setQuantity(newQuantity);
                  if (setTotalPrice)
                    setTotalPrice(
                      (cur) =>
                        cur -
                        quantity * Number(price) +
                        newQuantity * Number(price),
                    );
                  editCartItems(Number(e.target.value));
                }}
              />

              {/* addButton */}
              <IconButton disableRipple onClick={handleProductQuantity('add')}>
                <Plus className={addToCartClasses.circIcon.fSize[platform]} />
              </IconButton>
            </Box>

            <Box className={addToCartClasses.price[platform]}>
              <Typography
                className={`${fontClassName.className} ${addToCartClasses.priceText[platform]}`}
              >
                {quantity * Number(price)} TMT
              </Typography>
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
                  <Minus className={addToCartClasses.detail.quantityButton} />
                </IconButton>

                {/* quantityInput */}
                <Input
                  name="quantity"
                  inputProps={{ min: 1 }}
                  className={`${addToCartClasses.input[platform]} ${fontClassName.className}`}
                  value={quantity}
                  disableUnderline
                  onChange={(e) => {
                    const newQuantity = Number(e.target.value);
                    setQuantity(newQuantity);
                    setTotalPrice(
                      (cur) =>
                        cur -
                        quantity * Number(price) +
                        newQuantity * Number(price),
                    );
                  }}
                />

                {/* addButton */}
                <IconButton
                  onClick={handleProductQuantity('quantityAdd')}
                  className={addToCartClasses.iconButton[platform]}
                >
                  <Plus className={addToCartClasses.detail.quantityButton} />
                </IconButton>
              </Box>

              {/* addCart */}
              <IconButton
                className={addToCartClasses.detail.addToCart[platform]}
                onClick={addCartItems}
                disableRipple
              >
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
