import { AddToCartProps, SnackbarProps } from '@/pages/lib/types';
import { useUserContext } from '@/pages/lib/UserContext';
import { ShoppingCart } from '@mui/icons-material';
import AddCircleIcon from '@mui/icons-material/AddCircle';
import DeleteIcon from '@mui/icons-material/Delete';
import LoginIcon from '@mui/icons-material/Login';
import RemoveCircleIcon from '@mui/icons-material/RemoveCircle';
import { Alert, Box, IconButton, Input, Snackbar } from '@mui/material';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { Suspense, useCallback, useState } from 'react';

import { useFetchWithCreds } from '@/pages/lib/fetch';
import { usePlatform } from '@/pages/lib/PlatformContext';
import { debounce } from '@/pages/product/utils';
import { addToCartClasses } from '@/styles/classMaps/addToCart';
import CircularProgress from '@mui/material/CircularProgress';

export default function AddToCart({
  productId,
  quantity: initialQuantity = 1,
  cartAction,
  cartItemId = undefined,
  onDelete,
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

  const handleProductQuantity = (action: 'add' | 'remove' | 'edit') => () => {
    if (action === 'add') {
      setQuantity(quantity + 1);
      editCartItems(quantity + 1);
    } else if (action === 'remove') {
      if (quantity > 1) {
        setQuantity(quantity - 1);
        editCartItems(quantity - 1);
      }
    }
  };

  return (
    <Box>
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
          <Box className={addToCartClasses.circIcon.box}>
            {/* removeButton */}
            <IconButton
              className="p-0.3"
              onClick={handleProductQuantity('remove')}
            >
              <RemoveCircleIcon
                className={addToCartClasses.circIcon.fSize[platform]}
                color="primary"
              />
            </IconButton>

            {/* quantityInput */}
            <Input
              type="number"
              name="quantity"
              inputProps={{ min: 1 }}
              className={addToCartClasses.input}
              value={quantity}
              disableUnderline
              onChange={(e) => {
                setQuantity(Number(e.target.value));
                editCartItems(Number(e.target.value));
              }}
            />

            {/* addButton */}
            <IconButton
              onClick={handleProductQuantity('add')}
              className="p-0.3"
            >
              <AddCircleIcon
                className={addToCartClasses.circIcon.fSize[platform]}
                color="primary"
              />
            </IconButton>

            {/* delete button */}
            <IconButton
              color="primary"
              className="pr-1"
              type="submit"
              onClick={() => {
                onDelete(cartItemId);
                deleteCartItems(cartItemId);
              }}
            >
              <DeleteIcon
                color="error"
                className={addToCartClasses.circIcon.fSize[platform]}
              />
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
