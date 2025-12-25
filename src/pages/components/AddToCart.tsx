import { AddToCartProps, SnackbarProps } from '@/pages/lib/types';
import { useUserContext } from '@/pages/lib/UserContext';
import { ShoppingCart } from '@mui/icons-material';
import LoginIcon from '@mui/icons-material/Login';
import {
  Alert,
  Box,
  CardMedia,
  IconButton,
  Input,
  Snackbar,
  Typography,
} from '@mui/material';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { Suspense, useCallback, useEffect, useState } from 'react';

import { useFetchWithCreds } from '@/pages/lib/fetch';
import { usePlatform } from '@/pages/lib/PlatformContext';
import { debounce } from '@/pages/product/utils';
import { addToCartClasses } from '@/styles/classMaps/components/addToCart';
import { img, interClassname } from '@/styles/theme';
import AddIcon from '@mui/icons-material/Add';
import RemoveIcon from '@mui/icons-material/Remove';
import CircularProgress from '@mui/material/CircularProgress';

export default function AddToCart({
  productId,
  quantity: initialQuantity = 1,
  cartAction,
  cartItemId = undefined,
  price,
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

  const addCartItems = async () => {
    const userId = user?.id;

    if (userId == null) {
      setSnackbarOpen(true);
      setSnackbarMessage({
        message: 'userNotFound',
        severity: 'warning',
      });
    } else {
      try {
        const data = await fetchWithCreds({
          accessToken,
          path: '/api/cart',
          method: 'POST',
          body: {
            userId,
            productId,
            quantity,
          },
        });

        if (data.success) {
          setSnackbarOpen(true);
          setSnackbarMessage({
            message: 'addToCartSuccess',
            severity: 'success',
          });
        } else {
          setSnackbarOpen(true);
          setSnackbarMessage({
            message: data.message,
            severity:
              data.message === 'cartItemExistError' ? 'warning' : 'error',
          });
        }
      } catch (error) {
        console.error(t('addToCartFail'));
      }
    }
  };

  const deleteCartItems = async (cartId: string) => {
    try {
      const data = await fetchWithCreds({
        accessToken,
        path: '/api/cart',
        method: 'DELETE',
        body: {
          id: cartId,
        },
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
        const data = await fetchWithCreds({
          accessToken,
          path: '/api/cart',
          method: 'PUT',
          body: {
            id: cartItemId,
            quantity: itemQuantity,
          },
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

  // TODO: this might create a race condition across items.
  // Need to find a synchronous way of doing it
  useEffect(() => {
    if (price?.startsWith('[')) return;
    if (setTotalPrice) setTotalPrice((curr) => curr + quantity * Number(price));
  }, [price]);

  return (
    <Box className={addToCartClasses.main[platform]}>
      <Suspense fallback={<CircularProgress />}>
        {/* cartIcon */}
        {cartAction === 'add' && (
          <Box className={addToCartClasses.cartIcon.box}>
            <IconButton
              type="submit"
              onClick={addCartItems}
              className={addToCartClasses.cartIcon.iButton}
            >
              <ShoppingCart
                className={addToCartClasses.cartIcon.fSize[platform]}
              />
            </IconButton>
          </Box>
        )}

        {cartAction === 'delete' && (
          <Box className={addToCartClasses.circIcon.box[platform]}>
            <Box className={addToCartClasses.quanChange[platform]}>
              {/* removeButton */}
              <IconButton
                disableRipple
                onClick={handleProductQuantity('remove')}
              >
                <RemoveIcon
                  className={addToCartClasses.circIcon.fSize[platform]}
                />
              </IconButton>
              {/* quantityInput */}
              <Input
                name="quantity"
                inputProps={{ min: 1 }}
                className={`${addToCartClasses.inputDet[platform]} ${interClassname.className}`}
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
                        quantity * Number(price),
                    );
                  editCartItems(Number(e.target.value));
                }}
              />

              {/* addButton */}
              <IconButton disableRipple onClick={handleProductQuantity('add')}>
                <AddIcon
                  className={addToCartClasses.circIcon.fSize[platform]}
                />
              </IconButton>
            </Box>

            <Box className={addToCartClasses.price[platform]}>
              <Typography
                className={`${interClassname.className} ${addToCartClasses.priceText[platform]}`}
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
                <CardMedia
                  component="img"
                  src={img.trash[platform]}
                  className={addToCartClasses.deleteButton.deleteIcon[platform]}
                />
              </IconButton>
            </Box>
          </Box>
        )}

        {cartAction === 'detail' && (
          <Box className={addToCartClasses.detail.box[platform]}>
            <Box className="flex flex-row w-[15.3vw] h-[2.9vw] justify-between">
              {/* removeButton */}
              <IconButton
                onClick={handleProductQuantity('quantityRemove')}
                className={addToCartClasses.iconButton[platform]}
              >
                <RemoveIcon
                  className={addToCartClasses.detail.quantityButton}
                />
              </IconButton>

              {/* quantityInput */}
              <Input
                name="quantity"
                inputProps={{ min: 1 }}
                className={`${addToCartClasses.input[platform]} ${interClassname.className}`}
                value={quantity}
                disableUnderline
                onChange={(e) => {
                  const newQuantity = Number(e.target.value);
                  setQuantity(newQuantity);
                  setTotalPrice(
                    (cur) =>
                      cur - quantity * Number(price) + quantity * Number(price),
                  );
                }}
              />

              {/* addButton */}
              <IconButton
                onClick={handleProductQuantity('quantityAdd')}
                className={addToCartClasses.iconButton[platform]}
              >
                <AddIcon className={addToCartClasses.detail.quantityButton} />
              </IconButton>
            </Box>

            {/* addCart */}
            <IconButton
              className={addToCartClasses.detail.addToCart[platform]}
              onClick={addCartItems}
            >
              <Typography
                className={`${interClassname.className} ${addToCartClasses.detail.addToCartText[platform]}`}
              >
                {t('addToCart')}
              </Typography>
            </IconButton>
          </Box>
        )}
      </Suspense>

      {/* snackbarPop-ups */}
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
          severity={snackbarMessage?.severity}
          variant="filled"
          className="w-100%"
        >
          {snackbarMessage?.message && t(snackbarMessage.message)}
          {snackbarMessage?.message === 'userNotFound' && (
            <Link href="/user/signin">
              {`. ${t('signin')}`}
              <LoginIcon />
            </Link>
          )}
        </Alert>
      </Snackbar>
    </Box>
  );
}
