import BASE_URL from '@/lib/ApiEndpoints';
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
import { Suspense, useState } from 'react';

import CircularProgress from '@mui/material/CircularProgress';

export default function AddToCart({
  productId,
  quantity: initialQuantity = 1,
  cartAction,
  cartItemId = undefined,
  onDelete,
}: AddToCartProps) {
  // constants
  const [quantity, setQuantity] = useState(initialQuantity);
  const { user } = useUserContext();
  const [snackbarMessage, setSnackbarMessage] = useState<SnackbarProps>();
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const t = useTranslations();

  const addCartItems = async () => {
    const userId = user?.id;

    if (userId == null) {
      setSnackbarOpen(true);
      setSnackbarMessage({
        message: 'userNotFound',
        severity: 'warning',
      });
    } else {
      const response = await fetch(`${BASE_URL}/api/cart`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId,
          productId,
          quantity,
        }),
      });

      try {
        const data = await response.json();

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

  // deleteCartItems function
  const deleteCartItems = async (cartId: string) => {
    const response = await fetch(`${BASE_URL}/api/cart`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        id: cartId,
      }),
    });

    try {
      const data = await response.json();
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

  // calling editCartItems with debounce
  const [timeoutId, setTimeoutId] = useState<NodeJS.Timeout>(null);
  const debounceWithDelayedExecution = (
    func: (...args: any[]) => undefined | Promise<any>,
    delay: number,
  ) => {
    return (...args: any[]) => {
      clearTimeout(timeoutId);
      const timeout = setTimeout(() => {
        func(...args);
      }, delay);

      setTimeoutId(timeout);
    };
  };

  const editCartItems = debounceWithDelayedExecution(
    async (itemQuantity: number) => {
      const response = await fetch(`${BASE_URL}/api/cart`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id: cartItemId,
          quantity: itemQuantity,
        }),
      });

      try {
        const data = await response.json();

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
    },
    300,
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
          <Box
            sx={{ background: 'rgb(25, 118, 210)' }}
            className="rounded-full hover:bg-darkblue shadow"
          >
            <IconButton
              sx={{ pr: 1, color: 'white' }}
              type="submit"
              onClick={addCartItems}
              className="rounded-full bg-blue hover:bg-darkblue shadow"
            >
              <ShoppingCart
                sx={{
                  fontSize: {
                    xs: '1rem',
                    sm: '1.5rem',
                    md: '1.7rem',
                    lg: '1.7rem',
                  },
                }}
              />
            </IconButton>
          </Box>
        )}

        {cartAction === 'delete' && (
          <Box className="flex column-reverse items-center">
            {/* removeButton */}
            <IconButton
              sx={{ padding: 0.3 }}
              onClick={handleProductQuantity('remove')}
            >
              <RemoveCircleIcon
                sx={{
                  fontSize: {
                    xs: '1.3rem',
                    sm: '1.5rem',
                    md: '1.7rem',
                    lg: '1.7rem',
                  },
                }}
                color="primary"
              />
            </IconButton>

            {/* quantityInput */}
            <Input
              type="number"
              name="quantity"
              inputProps={{ min: 1 }}
              sx={{
                width: 'fit-content',
                maxWidth: 50,
                input: {
                  textAlign: 'center',
                },
              }}
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
              sx={{ padding: 0.3 }}
            >
              <AddCircleIcon
                sx={{
                  fontSize: {
                    xs: '1.3rem',
                    sm: '1.5rem',
                    md: '1.7rem',
                    lg: '1.7rem',
                  },
                }}
                color="primary"
              />
            </IconButton>

            {/* delete button */}
            <IconButton
              color="primary"
              sx={{ pr: 1 }}
              type="submit"
              onClick={() => {
                onDelete(cartItemId);
                deleteCartItems(cartItemId);
              }}
            >
              <DeleteIcon
                color="error"
                sx={{
                  fontSize: {
                    xs: '1.3rem',
                    sm: '1.5rem',
                    md: '1.7rem',
                    lg: '1.7rem',
                  },
                }}
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
          sx={{ width: '100%' }}
        >
          {snackbarMessage?.message && t(snackbarMessage.message)}
          {snackbarMessage?.message === 'userNotFound' && (
            <Link href="user/signin">
              {`. ${t('signin')}`}
              <LoginIcon />
            </Link>
          )}
        </Alert>
      </Snackbar>
    </Box>
  );
}
